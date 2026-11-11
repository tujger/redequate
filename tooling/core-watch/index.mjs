import { realpathSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer } from 'node:net'
import { watch } from 'rollup'
import { acquireCoreLock, CORE_PROTOCOL, CORE_READY, IDLE_TIMEOUT, HANDSHAKE_TIMEOUT } from './protocol.mjs'

export { acquireCoreLock }
const libraryRoot = fileURLToPath(new URL('../..', import.meta.url))

export async function runCoreWatcher({ root = libraryRoot, mode = 'manual' } = {}) {
  root = realpathSync(root)
  if (!['manual', 'shared'].includes(mode)) throw new Error('Unknown core watcher mode.')
  let release
  let watcher
  let idleTimer
  let finish
  let stopping = false
  let ready = false
  let failed = false
  let failure
  let state = { status: 'building' }
  let events = Promise.resolve()
  const clients = new Set()
  const sockets = new Set()
  const stopped = new Promise(resolve => { finish = resolve })
  const publish = next => {
    state = next
    for (const socket of clients) {
      if (socket.writableLength > 65536) socket.destroy()
      else socket.write(JSON.stringify({ type: 'state', ...state }) + '\n')
    }
  }
  const stop = error => {
    if (stopping) return
    stopping = true
    failure = error
    publish({ status: error ? 'fatal' : 'stopping', message: error?.message })
    finish()
  }
  const scheduleIdleStop = () => {
    clearTimeout(idleTimer)
    if (mode === 'shared' && clients.size === 0 && !stopping) idleTimer = setTimeout(() => stop(), IDLE_TIMEOUT)
  }
  const server = createServer(socket => {
    sockets.add(socket)
    socket.setNoDelay(true)
    let buffer = ''
    const timeout = setTimeout(() => socket.destroy(), HANDSHAKE_TIMEOUT)
    const authenticate = chunk => {
      buffer += chunk
      if (buffer.length > 4096) return socket.destroy()
      const index = buffer.indexOf('\n')
      if (index === -1) return
      let hello
      try { hello = JSON.parse(buffer.slice(0, index)) } catch { return socket.destroy() }
      const owner = release?.owner
      if (stopping || !owner || !hello || hello.version !== CORE_PROTOCOL || hello.root !== root || hello.token !== owner.token) return socket.destroy()
      clearTimeout(timeout)
      clearTimeout(idleTimer)
      socket.removeListener('data', authenticate)
      clients.add(socket)
      socket.write(JSON.stringify({ type: 'hello', ...owner, ...state }) + '\n')
    }
    socket.on('data', authenticate)
    socket.on('error', () => socket.destroy())
    socket.on('close', () => {
      clearTimeout(timeout)
      sockets.delete(socket)
      if (clients.delete(socket)) scheduleIdleStop()
    })
  })
  const onSignal = () => stop()
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    server.on('error', stop)
    release = acquireCoreLock(root, { port: server.address().port, mode })
    scheduleIdleStop()
    process.chdir(root)
    process.env.ROLLUP_WATCH = 'true'
    const { default: createBuild } = await import(pathToFileURL(root + '/rollup.config.mjs').href)
    watcher = watch(createBuild().map(config => ({ ...config, watch: { ...config.watch, buildDelay: 150 } })))
    watcher.on('close', () => { if (!stopping) stop(new Error('Core watcher closed unexpectedly.')) })
    watcher.on('event', event => {
      events = events.then(async () => {
        try {
          if (event.result) await event.result.close()
          if (stopping) return
          if (event.code === 'START') { failed = false; publish({ status: 'building' }) }
          if (event.code === 'ERROR') {
            failed = true
            console.error(`[Core watch] Build failed: ${event.error.message}`)
            if (!ready) stop(event.error)
            else publish({ status: 'error', message: event.error.message })
          }
          if (event.code === 'END' && !failed) {
            console.info(ready ? '[Core watch] Rebuilt.' : CORE_READY)
            ready = true
            publish({ status: 'ready' })
          }
        } catch (error) { stop(error) }
      })
    })
    console.info(`[Core watch] Watching ${root} (${mode})`)
    await stopped
  } finally {
    stopping = true
    clearTimeout(idleTimer)
    try { await watcher?.close(); await events } finally {
      for (const socket of sockets) socket.destroySoon()
      await new Promise(resolve => server.close(resolve))
      process.removeListener('SIGINT', onSignal)
      process.removeListener('SIGTERM', onSignal)
      release?.()
    }
  }
  if (failure) throw failure
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length && (args.length !== 3 || args[0] !== '--shared' || args[1] !== '--root')) throw new Error('Usage: core-watch/index.mjs [--shared --root <checkout>]')
    await runCoreWatcher(args.length ? { mode: 'shared', root: args[2] } : {})
  } catch (error) {
    console.error(`[Core watch] ${error.message}`)
    process.exitCode = 1
  }
}
