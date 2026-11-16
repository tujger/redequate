import { readFileSync, realpathSync, unlinkSync, writeFileSync, linkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export const CORE_READY = '[Core watch] Ready.'
export const CORE_PROTOCOL = 1
export const IDLE_TIMEOUT = 5000
export const HANDSHAKE_TIMEOUT = 2000
export const coreLockFile = root => join(realpathSync(root), 'node_modules/.redequate-core-watch.json')

// Never remove an unverifiable or live owner's lock, including older protocols.
function readOwner(root) {
  const file = coreLockFile(root)
  let text
  try { text = readFileSync(file, 'utf8') } catch (error) { if (error.code === 'ENOENT') return; throw error }
  let owner
  try { owner = JSON.parse(text) } catch { /* Report the file, never its token. */ }
  if (!Number.isSafeInteger(owner?.pid) || owner.pid <= 0) throw new Error(`Cannot verify core watcher lock: ${file}. Check its owner before removing it.`)
  try { process.kill(owner.pid, 0) } catch (error) {
    if (error.code !== 'ESRCH') throw new Error(`Cannot verify core watcher PID ${owner.pid}: ${error.message}`)
    try { if (readFileSync(file, 'utf8') === text) unlinkSync(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
    return
  }
  return owner
}

export function readCoreLock(root) {
  const owner = readOwner(root)
  if (!owner) return
  if (owner.version !== CORE_PROTOCOL || owner.root !== realpathSync(root) ||
      typeof owner.token !== 'string' || owner.token.length < 16 ||
      !Number.isInteger(owner.port) || owner.port < 1 || owner.port > 65535 ||
      !['manual', 'shared'].includes(owner.mode)) {
    throw new Error(`Core watcher PID ${owner.pid} uses an incompatible protocol or checkout. Stop and restart that watcher once; its lock has been preserved.`)
  }
  return owner
}

export function acquireCoreLock(root, details = {}) {
  const file = coreLockFile(root)
  const owner = { ...details, version: CORE_PROTOCOL, root: realpathSync(root), pid: process.pid, token: randomUUID() }
  const text = JSON.stringify(owner)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const temporary = `${file}.${owner.token}.tmp`
      writeFileSync(temporary, text, { flag: 'wx', mode: 0o600 })
      try { linkSync(temporary, file) } finally { unlinkSync(temporary) }
      const release = () => {
        try { if (readFileSync(file, 'utf8') === text) unlinkSync(file) } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      return Object.assign(release, { owner })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      const previous = readOwner(root)
      if (previous) throw new Error(`Redequate core watcher is already running (PID ${previous.pid}). Connect through the Firebase launcher or stop it before starting another manual watcher.`)
    }
  }
  throw new Error('Could not acquire the Redequate core watcher lock.')
}
