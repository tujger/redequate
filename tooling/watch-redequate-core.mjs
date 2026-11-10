import { existsSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { watch } from 'rollup'
import { CORE_READY } from './core-lifecycle.mjs'

const libraryRoot = fileURLToPath(new URL('../', import.meta.url))

export function acquireCoreLock(root) {
  const file = join(realpathSync(root), 'node_modules/.redequate-core-watch.json')
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID() })
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      writeFileSync(file, owner, { flag: 'wx' })
      return () => {
        if (existsSync(file) && readFileSync(file, 'utf8') === owner) unlinkSync(file)
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      let previous
      try { previous = readFileSync(file, 'utf8') } catch (error) { if (error.code === 'ENOENT') continue; throw error }
      let pid
      try { pid = JSON.parse(previous).pid } catch { /* An incomplete lock must not be stolen. */ }
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error(`Cannot verify core watcher lock: ${file}. Check its owner before removing it.`)
      try {
        process.kill(pid, 0)
      } catch (error) {
        if (error.code !== 'ESRCH') throw new Error(`Cannot verify core watcher PID ${pid}: ${error.message}`)
        if (existsSync(file) && readFileSync(file, 'utf8') === previous) unlinkSync(file)
        continue
      }
      throw new Error(`Redequate core watcher is already running (PID ${pid}). Stop it before starting another development session.`)
    }
  }
  throw new Error('Could not acquire the Redequate core watcher lock.')
}

export async function runCoreWatcher({ root = libraryRoot } = {}) {
  const release = acquireCoreLock(root)
  let watcher
  let finish
  let stopping = false
  let ready = false
  let failed = false
  let failure
  let events = Promise.resolve()
  const stopped = new Promise(resolve => { finish = resolve })
  const stop = error => {
    if (stopping) return
    stopping = true
    failure = error
    finish()
  }
  const onSignal = () => stop()
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  try {
    process.chdir(root)
    process.env.ROLLUP_WATCH = 'true'
    const { default: createBuild } = await import(pathToFileURL(join(root, 'rollup.config.mjs')).href)
    watcher = watch(createBuild().map(config => ({ ...config, watch: { ...config.watch, buildDelay: 150 } })))
    watcher.on('close', () => { if (!stopping) stop(new Error('Core watcher closed unexpectedly.')) })
    watcher.on('event', event => {
      events = events.then(async () => {
        try {
          if (event.result) await event.result.close()
          if (stopping) return
          if (event.code === 'START') failed = false
          if (event.code === 'ERROR') {
            failed = true
            console.error(`[Core watch] Build failed: ${event.error.message}`)
            if (!ready) stop(event.error)
          }
          if (event.code === 'END' && !failed) {
            console.info(ready ? '[Core watch] Rebuilt.' : CORE_READY)
            ready = true
          }
        } catch (error) { stop(error) }
      })
    })
    console.info(`[Core watch] Watching ${root}`)
    await stopped
  } finally {
    stopping = true
    try { await watcher?.close(); await events } finally {
      process.removeListener('SIGINT', onSignal)
      process.removeListener('SIGTERM', onSignal)
      release()
    }
  }
  if (failure) throw failure
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runCoreWatcher() } catch (error) {
    console.error(`[Core watch] ${error.message}`)
    process.exitCode = 1
  }
}
