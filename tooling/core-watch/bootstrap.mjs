import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Exit before clients subscribe so IDE process-tree termination cannot own the daemon.
const child = spawn(process.execPath, [fileURLToPath(new URL('./index.mjs', import.meta.url)), '--shared', '--root', process.argv[2]], {
  cwd: process.argv[2], env: process.env, detached: true, stdio: ['ignore', 1, 2]
})
child.once('error', error => {
  console.error(error.message)
  process.exitCode = 1
  if (process.connected) process.disconnect()
})
child.once('spawn', () => {
  child.unref()
  if (process.send) process.send({ pid: child.pid }, () => { if (process.connected) process.disconnect() })
})
