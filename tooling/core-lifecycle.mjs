import { fileURLToPath } from 'node:url'

// A protocol message emitted only after every Rollup configuration has succeeded.
export const CORE_READY = '[Core watch] Ready.'

export async function startCoreWatcher(group, options) {
  let ready
  const initialBuild = new Promise(resolve => { ready = resolve })
  const task = group.start(process.execPath, [fileURLToPath(new URL('./watch-redequate-core.mjs', import.meta.url))], {
    ...options,
    env: { ...options.env, NODE_OPTIONS: `${options.env?.NODE_OPTIONS || ''} --openssl-legacy-provider`.trim() },
    onLine(line) { if (line === CORE_READY) ready() }
  })
  await Promise.race([
    initialBuild,
    task.completed.then(({ code }) => { throw new Error(`Redequate core watcher exited before its first successful build (code ${code}).`) }),
    group.interrupted.then(({ code }) => { throw Object.assign(new Error('Core build interrupted.'), { exitCode: code }) })
  ])
  return task
}
