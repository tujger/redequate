import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { buildRulesSnapshot } from './build.mjs'
import { buildRules } from '../firebase-rules.mjs'

/** Generated library configs are disposable; developer data lives only in the app. */
export function prepareProjectRuntime(settings, { isolated = false, environment = settings.environment ?? 'emulator', hostingOnly = false } = {}) {
  const directory = mkdtempSync(join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'redequate-app-'))
  try {
    const { root } = settings
    const configuration = structuredClone(settings.environments[environment].configuration)

    const config = structuredClone(settings.firebase)
    config.emulators = structuredClone(settings.emulators)
    if (isolated) {
      for (const endpoint of Object.values(config.emulators)) if (endpoint.port) endpoint.port += 10000
      config.emulators.ui = { enabled: false }
      delete config.hosting
    } else {
      const hosting = config.hosting ?? { public: 'build', ignore: ['**/.*', '**/node_modules/**'], rewrites: [{ source: '**', destination: '/index.html' }] }
      const entries = Array.isArray(hosting) ? hosting : [hosting]
      entries.forEach(entry => {
        entry.public = resolve(root, entry.public ?? 'build')
        if (hostingOnly && entry.public !== resolve(root, 'build')) throw new Error('Hosting public must reference the build output.')
        entry.ignore = [...new Set([...(entry.ignore ?? ['**/.*', '**/node_modules/**']), '.redequate-build.json', '.redequate-rules.json'])]
      })
      config.hosting = Array.isArray(hosting) ? entries : entries[0]
    }
    if (hostingOnly) {
      const configFile = join(directory, 'firebase.json')
      writeFileSync(join(directory, 'database.rules.json'), readFileSync(buildRulesSnapshot(settings)))
      const hostingConfig = { hosting: config.hosting, database: { rules: 'database.rules.json' } }
      writeFileSync(configFile, JSON.stringify(hostingConfig))
      return { config: hostingConfig, configFile, configuration, temporaryDirectory: directory }
    }
    buildRules(settings.configFile, { output: join(directory, 'database.rules.json') })
    config.database = { rules: 'database.rules.json' }
    const storageRules = resolve(root, config.storage?.rules ?? 'storage.rules')
    writeFileSync(join(directory, 'storage.rules'), readFileSync(storageRules))
    config.storage = { ...config.storage, rules: 'storage.rules' }
    const functions = config.functions ?? { source: 'functions' }
    if (Array.isArray(functions)) throw new Error('This runner currently requires one Functions source.')
    const functionsDir = resolve(root, functions.source ?? 'functions')
    if (!existsSync(functionsDir)) throw new Error(`Missing Functions directory: ${functionsDir}`)
    if (environment === 'emulator') {
      const localFunctions = join(directory, 'functions')
      mkdirSync(localFunctions)
      for (const name of readdirSync(functionsDir)) {
        if (name !== '.secret.local') symlinkSync(join(functionsDir, name), join(localFunctions, name))
      }
      // Callable registration must not fetch production secrets for a local run.
      writeFileSync(join(localFunctions, '.secret.local'), 'GMAIL_EMAIL=emulator@example.test\nGMAIL_PASSWORD=emulator-only\n', { mode: 0o600 })
    } else symlinkSync(functionsDir, join(directory, 'functions'), 'dir')
    config.functions = { ...functions, source: 'functions' }
    const runtimeDirectory = join(directory, 'runtime')
    mkdirSync(runtimeDirectory)
    const configFile = join(directory, 'firebase.json')
    const clientConfigFile = join(directory, 'client.json')
    writeFileSync(configFile, JSON.stringify(config))
    writeFileSync(clientConfigFile, JSON.stringify({ configuration, emulators: config.emulators, isolated }))
    return { config, configuration, configFile, clientConfigFile, runtimeDirectory, temporaryDirectory: directory, directory: isolated ? join(directory, 'data') : join(root, '.firebase/emulator-data', configuration.projectId) }
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error }
}
