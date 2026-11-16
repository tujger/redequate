import { closeSync, openSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { CORE_READY, CORE_PROTOCOL, HANDSHAKE_TIMEOUT, readCoreLock } from './protocol.mjs'

export { CORE_READY }
const libraryRoot = fileURLToPath(new URL('../..', import.meta.url))

export function connectCoreWatcher(owner, { onState = message => console.info(message) } = {}) {
  const socket = createConnection({ host: '127.0.0.1', port: owner.port })
  let resolveReady, rejectReady, finish
  let authenticated = false
  let released = false
  let buffer = ''
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject })
  const completed = new Promise(resolve => { finish = resolve })
  const fail = error => { rejectReady(error); socket.destroy() }
  const timeout = setTimeout(() => fail(new Error(`Core watcher PID ${owner.pid} did not authenticate within 2 seconds. Restart that watcher; its lock has been preserved.`)), HANDSHAKE_TIMEOUT)
  socket.on('connect', () => socket.write(JSON.stringify({ version: CORE_PROTOCOL, root: owner.root, token: owner.token }) + '\n'))
  socket.on('error', () => fail(new Error(`Cannot connect to core watcher PID ${owner.pid}. Restart that watcher; its lock has been preserved.`)))
  socket.on('data', chunk => {
    buffer += chunk
    if (buffer.length > 65536) return fail(new Error('Invalid core watcher response.'))
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      let message
      try { message = JSON.parse(line) } catch { return fail(new Error('Invalid core watcher response.')) }
      if (!message || typeof message !== 'object') return fail(new Error('Invalid core watcher response.'))
      if (!authenticated) {
        if (message.type !== 'hello' || message.version !== CORE_PROTOCOL || message.root !== owner.root || message.pid !== owner.pid || message.token !== owner.token) return fail(new Error('Core watcher identity mismatch; its lock has been preserved.'))
        authenticated = true
        clearTimeout(timeout)
        onState(`[Core watch] Connected to PID ${owner.pid} (${owner.mode}).`)
      } else if (message.type !== 'state') return fail(new Error('Invalid core watcher response.'))
      if (message.status === 'ready') { onState(CORE_READY); resolveReady() } else if (message.status === 'error') onState(`[Core watch] Build failed: ${message.message}`)
      else if (message.status === 'fatal' || message.status === 'stopping') fail(new Error(`Core watcher stopped: ${message.message || message.status}`))
      else if (message.status !== 'building') return fail(new Error('Invalid core watcher state.'))
    }
  })
  socket.on('close', () => {
    clearTimeout(timeout)
    rejectReady(new Error(released ? 'Core watcher connection released.' : 'Core watcher disconnected before its first successful build.'))
    finish({ code: released ? 0 : 1 })
  })
  const release = () => { released = true; socket.destroy() }
  return { ready, completed, release }
}

export async function startCoreWatcher(group, options, { root = libraryRoot, onState } = {}) {
  root = realpathSync(root)
  let lease
  let cancelled = false
  let timer
  const acquire = async () => {
    let child
    let childFailed = false
    let bootstrapExited = false
    let daemonPid
    while (true) {
      if (cancelled) return
      if (daemonPid && bootstrapExited) {
        try { process.kill(daemonPid, 0) } catch (error) { if (error.code === 'ESRCH') childFailed = true; else throw error }
      }
      const owner = (!child || bootstrapExited) && readCoreLock(root)
      if (owner) {
        lease = connectCoreWatcher(owner, { onState })
        await lease.ready
        return lease
      }
      if (childFailed) throw new Error(`Core watcher exited before its first successful build. See ${join(root, 'node_modules/.redequate-core-watch.log')}`)
      if (!child) {
        const log = openSync(join(root, 'node_modules/.redequate-core-watch.log'), 'a', 0o600)
        try {
          child = spawn(process.execPath, [fileURLToPath(new URL('./bootstrap.mjs', import.meta.url)), root], {
            cwd: root,
            env: { ...options.env, NODE_OPTIONS: `${options.env?.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim() },
            detached: true,
            stdio: ['ignore', log, log, 'ipc']
          })
          child.on('error', () => { childFailed = true })
          child.on('message', message => { if (Number.isSafeInteger(message?.pid) && message.pid > 0) daemonPid = message.pid })
          child.on('exit', code => { bootstrapExited = true; if (code !== 0 || !daemonPid) childFailed = true })
          child.unref()
        } finally { closeSync(log) }
      }
      await delay(100)
    }
  }
  try {
    return await Promise.race([
      acquire(),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Core watcher was not ready within 180 seconds.')), 180000) }),
      group.interrupted.then(({ code }) => { throw Object.assign(new Error('Core build interrupted.'), { exitCode: code }) })
    ])
  } catch (error) {
    cancelled = true
    lease?.release()
    throw error
  } finally { clearTimeout(timer) }
}
