import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProjectConfig, selectProjectEnvironment } from './app-config.mjs'
import runFirebase from './app/run.mjs'
import { readBuild } from './app/build.mjs'
import { buildRules } from './firebase-rules.mjs'

export async function appCLI(argv = process.argv.slice(2)) {
  if (argv[0] !== '--config' || !argv[1] || !argv[2]) throw new Error('Usage: app.mjs --config redequate.config.json <action> [environment] [--http|--https]')
  const settings = loadProjectConfig(resolve(argv[1]))
  const args = argv.slice(2)
  const action = args.shift()
  const requested = args[0] && !args[0].startsWith('--') ? args.shift() : undefined
  const usesBuild = ['preview', 'deploy-hosting'].includes(action)
  if (usesBuild && requested) throw new Error('serve and deploy use the build target; do not specify an environment.')
  const target = usesBuild ? readBuild(settings).environment : requested ?? settings.defaultEnvironment
  if (args.some(arg => !['--http', '--https'].includes(arg)) || args.length > 1) throw new Error('Unknown project command option.')
  if (args.length) settings.server.https = args[0] === '--https'
  if (action === 'rules') { console.info(buildRules(settings.configFile)); return 0 }
  return runFirebase(selectProjectEnvironment(settings, target), [action, target])
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  appCLI().then(code => { process.exitCode = code }).catch(error => { console.error(error.message); process.exitCode = 1 })
}
