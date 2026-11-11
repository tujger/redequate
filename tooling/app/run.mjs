import { stripVTControlCharacters } from 'node:util'
import { watchRules } from '../firebase-rules.mjs'
import { existsSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import Processes from './processes.mjs'
import { startCoreWatcher } from '../core-watch/client.mjs'
import seedEmulator, { validateSeedConfig } from './seed.mjs'
import { readBuild, recordBuild, invalidateBuild } from './build.mjs'
import { prepareProjectRuntime } from './runtime.mjs'

// Firebase CLI 15 emits these lifecycle messages after startAll and before cleanup.
export function observeEmulatorLine(line, task) {
  const text = stripVTControlCharacters(line)
  if (text.includes('All emulators ready!')) task.ready = true
  if (text.includes('Shutting down emulators.') || text.includes('Starting a clean shutdown.')) task.shutdownStarted = true
}

export function emulatorReady(task) {
  return task.ready === true && !task.shutdownStarted && !task.exited
}

export function validateFirebaseConfig(settings, argv) {
  if (typeof settings?.configFile !== 'string' || typeof settings.root !== 'string' || !settings.root ||
        !settings.environments || !settings.testing) throw new Error('Firebase configuration requires root, projects, modes and emulator settings.')
  const [action, target] = argv
  const actions = ['start', 'build', 'preview', 'deploy-hosting', 'deploy-functions', 'test', 'test-unit']
  if (argv.length !== 2 || !settings.environments[target]?.projectId ||
        !actions.includes(action) || (target === 'emulator' && !['start', 'test'].includes(action)) ||
        (action === 'test' && target !== 'emulator') || !settings.environments[target]?.mode) {
    throw new Error('Use an explicit configured Firebase action and target.')
  }
  const { emulator } = settings.environments
  if (typeof settings.testing.file !== 'string' || !settings.testing.file ||
      (emulator.readyCallable !== undefined && (typeof emulator.readyCallable !== 'string' || !emulator.readyCallable || emulator.readyCallable.includes('/')))) {
    throw new Error('Configure a test file and an optional callable name.')
  }
  if (emulator.seed) validateSeedConfig(emulator.seed)
  return { ...settings, root: resolve(settings.root) }
}

export default async function runFirebase(input, argv = process.argv.slice(2), { startCore = startCoreWatcher } = {}) {
  const settings = validateFirebaseConfig(input, argv)
  const { root } = settings
  const [action, target] = argv
  if (['preview', 'deploy-hosting'].includes(action) && readBuild(settings).environment !== target) throw new Error('Use the environment recorded in the build.')
  let exitCode = 0
  const emulator = target === 'emulator'
  let local
  const project = settings.environments[target].projectId
  const mode = settings.environments[target].mode
  const group = new Processes()
  const env = { ...process.env }
  Object.assign(env, { REDEQUATE_CONFIG: settings.configFile, REDEQUATE_ENVIRONMENT: target, REDEQUATE_HTTPS: String(settings.server.https), HTTPS: String(settings.server.https), PORT: String(settings.server.port) })
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
  let coreTask
  let emulatorStartedAt
  let emulatorStarted = false
  const requireFromApp = createRequire(join(root, 'package.json'))
  const packageFile = (name, path) => join(dirname(requireFromApp.resolve(`${name}/package.json`)), path)
  const ownFile = path => fileURLToPath(new URL(path, import.meta.url))
  const cli = (...arguments_) => group.run(process.execPath, [packageFile('firebase-tools', 'lib/bin/firebase.js'), ...arguments_, '--project', project, '--config', local.configFile], options)
  const viteArgs = (...arguments_) => [packageFile('vite', 'bin/vite.js'), ...arguments_, '--mode', mode, '--config', ownFile('../vite.mjs')]
  const vite = (...arguments_) => group.run(process.execPath, viteArgs(...arguments_), options)

  const prepareServer = async props => {
    await group.run('sh', [ownFile('./link-react.sh'), root], options)
    await group.run(process.execPath, [ownFile('../server/prepare.mjs'), join(root, 'functions')], options)
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
        group.trackEmulatorProcesses(task, Object.values(services).map(service => service.pid))
        if (!emulatorReady(task)) throw new Error('Firebase CLI is still starting.')
        if (!settings.environments.emulator.readyCallable) {
          if (['functions', 'database', 'auth', 'storage'].every(name => services[name])) { emulatorStarted = true; return props }
          throw new Error('Emulator services are not ready.')
        }
        // Wait for the application's configured callable, not merely an open port.
        const response = await fetch(`${urls.functions}/${project}/${settings.environments.emulator.region ?? 'us-central1'}/${settings.environments.emulator.readyCallable}`, {
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
    if (settings.environments.emulator.seed) await seedEmulator({ ...settings.environments.emulator.seed, project, urls: props.urls, expectedProject: settings.environments.emulator.projectId, namespace: new URL(settings.environments.emulator.configuration.databaseURL).hostname.split('.')[0] })
    return props
  }

  const runLocal = async props => {
    if (action === 'test') {
      // Browser Firebase SDKs retain background resources in Node after deleteApp.
      // Exit only after all test assertions and cleanup hooks have completed.
      await Promise.race([
        group.run(process.execPath, ['--test', '--test-force-exit', resolve(root, settings.testing.file)], {
          ...options, env: { ...env, FIREBASE_EMULATOR_TEST_CONFIG: props.clientConfigFile }
        }),
        props.task.completed.then(() => { throw new Error('Emulator Suite exited during the checks.') })
      ])
    } else {
      group.start(process.execPath, [ownFile('../server/watch.mjs'), join(root, 'functions')], options)
      group.start(process.execPath, viteArgs(), options)
      const { code } = await group.wait()
      exitCode = code
    }
    return props
  }

  try {
    console.info(`[Firebase] ${emulator ? 'EMULATOR' : 'SERVER'} | ${project} | ${action}`)
    coreTask = action === 'start' ? await startCore(group, options) : undefined
    const execute = async () => {
      if (['deploy-hosting', 'deploy-functions'].includes(action)) local = prepareProjectRuntime(settings, { environment: target, hostingOnly: action === 'deploy-hosting' })
      if (emulator) {
        local = prepareProjectRuntime(settings, { isolated: action === 'test', environment: 'emulator' })
        if (action === 'start') rulesWatcher = watchRules(settings.configFile, { output: join(local.temporaryDirectory, 'database.rules.json') })
        await Promise.resolve(local).then(prepareServer).then(startEmulators).then(waitForEmulators).then(seed).then(runLocal)
      } else if (action === 'start') {
        await group.run('sh', [ownFile('./link-react.sh'), root], options)
        await vite()
      } else if (action === 'preview') {
        await vite('preview')
      } else if (action === 'test-unit') {
        await group.run(process.execPath, [packageFile('vitest', 'vitest.mjs'), 'run', '--config', join(root, 'vitest.config.mjs')], options)
      } else if (action === 'build') {
        invalidateBuild(settings)
        await vite('build')
        recordBuild(settings, target)
      } else if (action === 'deploy-hosting') {
        await cli('deploy', '--only', 'database')
        await cli('deploy', '--only', 'hosting')
      } else if (action === 'deploy-functions') {
        await prepareServer()
        await group.run('npm', ['--prefix', join(root, 'functions'), 'run', 'lint'], options)
        await cli('deploy', '--only', 'functions')
      }
    }
    await Promise.race([
      execute(),
      ...(coreTask
        ? [coreTask.completed.then(({ code }) => {
            throw Object.assign(new Error(`Redequate core watcher stopped (code ${code}).`), { exitCode: code || 1 })
          })]
        : [])
    ])
  } catch (error) {
    console.error(error.message)
    exitCode = group.stopping ? 130 : (error.exitCode || 1)
  } finally {
    rulesWatcher?.close()
    try { await group.stop() } finally { coreTask?.release() }
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
