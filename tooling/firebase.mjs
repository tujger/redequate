import { watchRules } from './firebase-rules.mjs'
import { existsSync, rmSync, statSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import Processes from './processes.mjs'
import { observeEmulatorLine, emulatorReady } from './emulator-lifecycle.mjs'
import seedEmulator, { validateSeedConfig } from './seed-emulator.mjs'
import emulatorConfig from './emulator-config.mjs'

export function validateFirebaseConfig(settings, argv) {
  if (!settings || typeof settings.root !== 'string' || !settings.root ||
        !settings.projects || !settings.modes || !settings.emulator) throw new Error('Firebase configuration requires root, projects, modes and emulator settings.')
  const [action, target] = argv
  const actions = ['start', 'build', 'deploy-hosting', 'deploy-functions', 'test']
  if (argv.length !== 2 || typeof settings.projects[target] !== 'string' || !settings.projects[target] ||
        !actions.includes(action) || (target === 'emulator' && !['start', 'test'].includes(action)) ||
        (action === 'test' && target !== 'emulator') || typeof settings.modes[target] !== 'string' || !settings.modes[target]) {
    throw new Error('Use an explicit configured Firebase action and target.')
  }
  const { emulator, projects } = settings
  if (!projects.emulator?.startsWith('demo-') || !emulator.testProjectId?.startsWith('demo-') ||
        projects.emulator === emulator.testProjectId || typeof emulator.clientConfig !== 'string' || !emulator.clientConfig ||
        typeof emulator.testFile !== 'string' || !emulator.testFile ||
        (emulator.readyCallable !== undefined && (typeof emulator.readyCallable !== 'string' || !emulator.readyCallable || emulator.readyCallable.includes('/')))) {
    throw new Error('Configure distinct local demo project IDs, clientConfig, testFile and an optional callable name.')
  }
  if (emulator.seed) validateSeedConfig(emulator.seed)
  return { ...settings, root: resolve(settings.root) }
}

export default async function runFirebase(input, argv = process.argv.slice(2)) {
  const settings = validateFirebaseConfig(input, argv)
  const { root, projects } = settings
  const [action, target] = argv
  let exitCode = 0
  const emulator = target === 'emulator'
  let local
  const project = emulator && action === 'test' ? settings.emulator.testProjectId : projects[target]
  const mode = settings.modes[target]
  const group = new Processes()
  const env = { ...process.env }
  if (action === 'start') env.HTTPS = 'true'
  for (const key of Object.keys(env)) {
    if (key.endsWith('_EMULATOR_HOST') || ['FUNCTIONS_EMULATOR', 'FIREBASE_CONFIG', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'DATABASE_URL', 'STORAGE_BUCKET_URL'].includes(key)) delete env[key]
  }
  if (emulator) {
    for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GMAIL_EMAIL', 'GMAIL_PASSWORD']) delete env[key]
    // Reuse the JDK already provisioned for this workspace, if available.
    const javaHome = join(homedir(), '.local/share/redequate/jdks/temurin-21/Contents/Home')
    if (!env.JAVA_HOME && existsSync(join(javaHome, 'bin/java'))) {
      env.JAVA_HOME = javaHome
      env.PATH = `${join(javaHome, 'bin')}${delimiter}${env.PATH || ''}`
    }
  }
  const options = { cwd: root, env }
  let rulesWatcher
  let emulatorStartedAt
  let emulatorStarted = false
  const requireFromApp = createRequire(join(root, 'package.json'))
  const packageFile = (name, path) => join(dirname(requireFromApp.resolve(`${name}/package.json`)), path)
  const ownFile = path => fileURLToPath(new URL(path, import.meta.url))
  const cli = (...arguments_) => group.run(process.execPath, [packageFile('firebase-tools', 'lib/bin/firebase.js'), ...arguments_, '--project', project], options)
  const vite = (...arguments_) => group.run(process.execPath, [packageFile('vite', 'bin/vite.js'), ...arguments_, '--mode', mode], options)

  const prepareServer = async props => {
    await group.run('sh', [ownFile('./link-redequate-react.sh'), root], options)
    await group.run(process.execPath, [ownFile('./prepare-redequate-server.mjs'), join(root, 'functions')], options)
    return props
  }

  const startEmulators = props => {
    const { directory, config, configuration, configFile } = props
    if (configuration.projectId !== project) throw new Error('Emulator project IDs must match.')
    const emulatorArgs = ['emulators:start', '--config', configFile, '--project', project, '--only', 'functions,database,auth,storage', '--non-interactive']
    if (existsSync(join(directory, 'firebase-export-metadata.json'))) emulatorArgs.push('--import', directory)
    if (action === 'start') {
      emulatorArgs.push('--export-on-exit', directory)
      console.info(`[EMULATOR] Persistent state: ${directory}. Wait for export to finish when stopping.`)
    }
    emulatorStartedAt = Date.now()
    const task = group.start(process.execPath, [packageFile('firebase-tools', 'lib/bin/firebase.js'), ...emulatorArgs], {
      ...options,
      cwd: props.temporaryDirectory ?? root,
      signalGroup: false,
      onLine: observeEmulatorLine,
      env: {
        ...env,
        ...(props.runtimeDirectory ? { TMPDIR: props.runtimeDirectory, TMP: props.runtimeDirectory, TEMP: props.runtimeDirectory } : {}),
        DATABASE_URL: configuration.databaseURL,
        STORAGE_BUCKET_URL: configuration.storageBucket,
        EMULATOR_FRONTEND_URL: `${env.HTTPS === 'true' ? 'https' : 'http'}://localhost:${env.PORT || 3000}`
      }
    })
    const urls = Object.fromEntries(Object.entries(config.emulators).filter(([, value]) => value.port)
      .map(([name, value]) => [name, `http://${value.host === '0.0.0.0' ? '127.0.0.1' : value.host}:${value.port}`]))
    console.info('[EMULATOR]', { project, ...urls })
    return { ...props, task, urls }
  }

  const waitForEmulators = async props => {
    const { task, urls } = props
    const deadline = Date.now() + 180000
    while (Date.now() < deadline) {
      if (group.stopping || task.exited || task.shutdownStarted) throw new Error('Emulator Suite stopped before it was ready.')
      try {
        const hub = await fetch(urls.hub, { signal: AbortSignal.timeout(1000) }).then(response => response.json())
        if (hub.pid !== task.child.pid) throw new Error('The emulator hub belongs to another process.')
        const services = await fetch(`${urls.hub}/emulators`, { signal: AbortSignal.timeout(1000) }).then(response => response.json())
        for (const { pid } of Object.values(services)) {
          if (Number.isInteger(pid) && pid > 0) group.detachedPids.add(pid)
        }
        if (!emulatorReady(task)) throw new Error('Firebase CLI is still starting.')
        if (!settings.emulator.readyCallable) {
          if (['functions', 'database', 'auth', 'storage'].every(name => services[name])) { emulatorStarted = true; return props }
          throw new Error('Emulator services are not ready.')
        }
        // Wait for the application's configured callable, not merely an open port.
        const response = await fetch(`${urls.functions}/${project}/${settings.emulator.region ?? 'us-central1'}/${settings.emulator.readyCallable}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: {} }),
          signal: AbortSignal.timeout(2000)
        })
        const body = await response.json()
        if (response.status === 401 && body.error?.status === 'UNAUTHENTICATED' && emulatorReady(task)) { emulatorStarted = true; return props }
      } catch { /* Services are still starting. */ }
      await delay(500)
    }
    throw new Error('Emulator Suite was not ready within 180 seconds. See firebase-debug.log.')
  }

  const seed = async props => {
    if (settings.emulator.seed) await seedEmulator({ ...settings.emulator.seed, project, urls: props.urls })
    return props
  }

  const runLocal = async props => {
    if (action === 'test') {
      // Browser Firebase SDKs retain background resources in Node after deleteApp.
      // Exit only after all test assertions and cleanup hooks have completed.
      await Promise.race([
        group.run(process.execPath, ['--test', '--test-force-exit', resolve(root, settings.emulator.testFile)], {
          ...options, env: { ...env, FIREBASE_EMULATOR_TEST_CONFIG: props.clientConfigFile }
        }),
        props.task.completed.then(() => { throw new Error('Emulator Suite exited during the checks.') })
      ])
    } else {
      group.start(process.execPath, [ownFile('./watch-redequate-server.mjs'), join(root, 'functions')], options)
      group.start(process.execPath, [packageFile('vite', 'bin/vite.js'), '--mode', mode], options)
      const { code } = await group.wait()
      exitCode = code
    }
    return props
  }

  try {
    console.info(`[Firebase] ${emulator ? 'EMULATOR' : 'SERVER'} | ${project} | ${action}`)
    if (emulator) {
      local = emulatorConfig(settings, { isolated: action === 'test' })
      if (action === 'start') rulesWatcher = watchRules(join(root, 'database-rules.config.json'))
      await Promise.resolve(local).then(prepareServer).then(startEmulators).then(waitForEmulators).then(seed).then(runLocal)
    } else if (action === 'start') {
      await group.run('sh', [ownFile('./link-redequate-react.sh'), root], options)
      await vite()
    } else if (action === 'build') {
      await vite('build')
    } else if (action === 'deploy-hosting') {
      await vite('build')
      await cli('deploy', '--only', 'hosting')
    } else if (action === 'deploy-functions') {
      await cli('deploy', '--only', 'functions')
    }
  } catch (error) {
    console.error(error.message)
    exitCode = group.stopping ? 130 : (error.exitCode || 1)
  } finally {
    rulesWatcher?.close()
    await group.stop()
    if (emulator && action === 'start' && emulatorStarted) {
      const metadata = join(local.directory, 'firebase-export-metadata.json')
      if (!existsSync(metadata) || statSync(metadata).mtimeMs < emulatorStartedAt) {
        console.error(`[EMULATOR] State export failed: ${local.directory}. See the Firebase CLI output above.`)
        exitCode = 1
      } else console.info(`[EMULATOR] State saved: ${local.directory}`)
    }
    if (local?.temporaryDirectory) rmSync(local.temporaryDirectory, { recursive: true, force: true })
  }
  return exitCode
}

export async function firebaseCLI(argv = process.argv.slice(2)) {
  if (argv.length !== 4 || argv[0] !== '--config') throw new Error('Usage: firebase.mjs --config <firebase.config.mjs> <action> <target>')
  const configFile = resolve(argv[1])
  const configuration = (await import(pathToFileURL(configFile).href)).default
  return runFirebase({ ...configuration, root: dirname(configFile) }, argv.slice(2))
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await firebaseCLI() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
