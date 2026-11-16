import { execFileSync, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'

export function readProcessTable() {
  try {
    const output = execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,command='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const table = new Map()
    for (const line of output.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.+)$/)
      if (match) {
        const [, pid, ppid, pgid, started, command] = match
        table.set(Number(pid), { pid: Number(pid), ppid: Number(ppid), pgid: Number(pgid), started: started.replace(/\s+/g, ' '), command })
      }
    }
    return table
  } catch { return new Map() } // Unverifiable processes must not be signalled by PID.
}

export const sameProcess = (before, after) => !!before && !!after && before.pid === after.pid && before.started === after.started && before.command === after.command

export function isDescendant(table, pid, ancestor) {
  const seen = new Set()
  while (table.has(pid) && !seen.has(pid)) {
    if (pid === ancestor) return true
    seen.add(pid)
    pid = table.get(pid).ppid
  }
  return false
}

export default class Processes {
  tasks = []
  ownedProcesses = new Map()
  stopPromise
  stopping = false
  interrupted = new Promise(resolve => { this.interrupt = resolve })

  constructor({ graceMs = 75000, readProcesses = readProcessTable } = {}) {
    this.graceMs = graceMs
    this.readProcesses = readProcesses
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
    const task = { child, exited: false, signalGroup, identity: this.readProcesses().get(child.pid) }
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

  trackEmulatorProcesses(task, pids) {
    const table = this.readProcesses()
    if (task.exited || !sameProcess(task.identity, table.get(task.child.pid))) return
    for (const pid of pids) {
      if (pid !== task.child.pid && isDescendant(table, pid, task.child.pid)) this.ownedProcesses.set(pid, table.get(pid))
    }
  }

  stop() {
    this.stopPromise ??= this.stopOwnedProcesses()
    return this.stopPromise
  }

  async stopOwnedProcesses() {
    this.stopping = true
    try {
      const table = this.readProcesses()
      for (const task of this.tasks) {
        if (sameProcess(task.identity, table.get(task.child.pid))) {
          this.ownedProcesses.set(task.child.pid, task.identity)
          if (task.signalGroup) {
            for (const [pid, identity] of table) {
              if (isDescendant(table, pid, task.child.pid)) this.ownedProcesses.set(pid, identity)
            }
          }
        }
        if (task.exited || task.shutdownStarted) continue
        // ChildProcess handles are only used while the spawned child is still alive.
        if (!task.signalGroup) task.child.kill('SIGINT')
        else if (sameProcess(task.identity, table.get(task.child.pid))) {
          for (const [pid, identity] of this.ownedProcesses) {
            if (isDescendant(table, pid, task.child.pid)) this.signalOwned(identity, 'SIGINT')
          }
        } else task.child.kill('SIGINT')
      }
      // Preserve Firebase CLI's graceful export before touching detached descendants.
      const deadline = Date.now() + this.graceMs
      while (this.tasks.some(task => !task.exited) && Date.now() < deadline) await delay(25)
      for (const task of this.tasks) {
        if (!task.exited) task.child.kill('SIGKILL')
      }
      for (const identity of this.ownedProcesses.values()) this.signalOwned(identity, 'SIGKILL')
      const cleanupDeadline = Date.now() + 5000
      while (Date.now() < cleanupDeadline) {
        const remaining = this.readProcesses()
        if (![...this.ownedProcesses.values()].some(identity => sameProcess(identity, remaining.get(identity.pid)))) break
        await delay(25)
      }
      await Promise.all(this.tasks.map(task => task.completed))
    } finally {
      process.removeListener('SIGINT', this.onSignal)
      process.removeListener('SIGTERM', this.onSignal)
    }
  }

  signalOwned(identity, signal) {
    if (!sameProcess(identity, this.readProcesses().get(identity.pid))) return
    try { process.kill(identity.pid, signal) } catch (error) { if (error.code !== 'ESRCH') console.error(error.message) }
  }
}
