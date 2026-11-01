import { buildRules } from './firebase-rules.mjs'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path'

export default function emulatorConfig(settings, { isolated = false } = {}) {
  const { root, projects, emulator } = settings
  const readJSON = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  if (!projects?.emulator?.startsWith('demo-') || !emulator?.testProjectId?.startsWith('demo-') ||
        emulator.testProjectId === projects.emulator) throw new Error('Use distinct demo projects for development and tests.')
  const config = readJSON('firebase.json')
  const configuration = readJSON(emulator.clientConfig)
  if (configuration.projectId !== projects.emulator) throw new Error('Unexpected developer emulator project ID.')
  if (!isolated) {
    buildRules(join(root, 'database-rules.config.json'))
    return {
      config,
      configuration,
      configFile: join(root, 'firebase.json'),
      directory: join(root, '.firebase/emulator-data')
    }
  }

  // macOS Unix socket paths cannot fit inside its long default temp path.
  const temporaryDirectory = mkdtempSync(join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'redequate-app-emulators-'))
  try {
    const runtimeDirectory = join(temporaryDirectory, 'runtime')
    mkdirSync(runtimeDirectory)
    const project = emulator.testProjectId
    Object.assign(configuration, {
      projectId: project,
      apiKey: project,
      appId: project,
      databaseURL: `https://${project}-default-rtdb.firebaseio.com`,
      storageBucket: `${project}.appspot.com`
    })
    for (const service of Object.values(config.emulators)) {
      if (service.port) service.port += 10000
    }
    Object.assign(config.emulators, {
      ui: { enabled: false },
      logging: { host: '127.0.0.1', port: 14500 },
      eventarc: { host: '127.0.0.1', port: 19299 },
      tasks: { host: '127.0.0.1', port: 19499 }
    })
    // Firebase requires the Functions source to live inside its config directory.
    config.functions = { source: 'functions' }
    delete config.hosting
    symlinkSync(join(root, 'functions'), join(temporaryDirectory, 'functions'), 'dir')
    const inside = path => {
      if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('Emulator Rules paths must be relative.')
      const output = resolve(temporaryDirectory, path)
      const location = relative(temporaryDirectory, output)
      if (!location || location === '..' || location.startsWith(`..${sep}`)) throw new Error('Emulator Rules path escapes its temporary directory.')
      return output
    }
    buildRules(join(root, 'database-rules.config.json'), { output: inside(config.database.rules) })
    mkdirSync(dirname(inside(config.storage.rules)), { recursive: true })
    writeFileSync(inside(config.storage.rules), readFileSync(join(root, config.storage.rules)))
    const configFile = join(temporaryDirectory, 'firebase.json')
    const clientConfigFile = join(temporaryDirectory, 'client.json')
    writeFileSync(configFile, JSON.stringify(config))
    writeFileSync(clientConfigFile, JSON.stringify({ configuration, emulators: config.emulators }))
    return {
      config,
      configuration,
      configFile,
      clientConfigFile,
      temporaryDirectory,
      runtimeDirectory,
      directory: join(temporaryDirectory, 'data')
    }
  } catch (error) {
    rmSync(temporaryDirectory, { recursive: true, force: true })
    throw error
  }
}
