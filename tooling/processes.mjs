import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'

export default class Processes {
  tasks = []
  detachedPids = new Set()
  stopping = false
  interrupted = new Promise(resolve => { this.interrupt = resolve })

  constructor() {
    this.onSignal = signal => {
      this.stopping = true
      this.interrupt({ code: signal === 'SIGINT' ? 130 : 143 })
    }
    process.on('SIGINT', this.onSignal)
    process.on('SIGTERM', this.onSignal)
  }

  start(command, args, { signalGroup = true, onLine, ...options }) {
    if (this.stopping) throw new Error('Launch interrupted.')
    const child = spawn(command, args, { ...options, stdio: onLine ? ['inherit', 'pipe', 'pipe'] : 'inherit', detached: process.platform !== 'win32' })
    const task = { child, exited: false, signalGroup }
    if (onLine) {
      for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
        stream.on('data', chunk => output.write(chunk))
        createInterface({ input: stream }).on('line', line => onLine(line, task))
      }
    }
    task.completed = new Promise(resolve => {
      child.once('error', error => {
        console.error(error.message)
        task.exited = true
        resolve({ code: 1 })
      })
      child.once('exit', (code, signal) => {
        task.exited = true
        resolve({ code: code ?? (signal === 'SIGINT' ? 130 : 1) })
      })
    })
    this.tasks.push(task)
    return task
  }

  async run(command, args, options) {
    const task = this.start(command, args, options)
    const { code } = await Promise.race([task.completed, this.interrupted])
    if (code !== 0) throw Object.assign(new Error(`${command} exited with ${code}.`), { exitCode: code })
  }

  async wait() {
    return Promise.race([...this.tasks.filter(task => !task.exited).map(task => task.completed), this.interrupted])
  }

  async stop() {
    this.stopping = true
    const signal = (task, name) => {
      if (!task.child.pid) return
      try {
        if (process.platform === 'win32' || !task.signalGroup) task.child.kill(name)
        else process.kill(-task.child.pid, name)
      } catch (error) {
        if (error.code !== 'ESRCH') console.error(error.message)
      }
    }
    // Signal groups even if their leader exited: npm/CLI may leave children.
    this.tasks.filter(task => !task.shutdownStarted && !(task.exited && !task.signalGroup)).forEach(task => signal(task, 'SIGINT'))
    const timeout = new AbortController()
    await Promise.race([
      Promise.all(this.tasks.map(task => task.completed)).then(() => true),
      // Functions Emulator allows up to 60 seconds to drain its work queue.
      delay(75000, false, { signal: timeout.signal }).catch(() => false)
    ])
    timeout.abort()
    // Only after CLI shutdown/export: Java emulators may outlive their leader.
    for (const pid of this.detachedPids) {
      try { process.kill(pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') console.error(error.message) }
    }
    this.tasks.forEach(task => signal({ ...task, signalGroup: true }, 'SIGKILL'))
    process.removeListener('SIGINT', this.onSignal)
    process.removeListener('SIGTERM', this.onSignal)
  }
}
