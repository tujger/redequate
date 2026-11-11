import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const readJSON = file => JSON.parse(readFileSync(file, 'utf8'))
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const port = value => Number.isInteger(value) && value > 0 && value <= 65535

/** The only project-level input. Paths are relative to this JSON, never to cwd. */
export function loadProjectConfig(file) {
  file = resolve(file)
  const root = dirname(file)
  const input = readJSON(file)
  if (!record(input) || Object.keys(input).some(key => !['server', 'environments', 'defaultEnvironment', 'testing'].includes(key))) throw new Error('Invalid redequate.config.json: use server, environments, defaultEnvironment and testing.')
  if (!record(input.environments) || !record(input.environments.emulator)) throw new Error('Configure environments including emulator.')
  if (input.server !== undefined && (!record(input.server) || Object.keys(input.server).some(key => !['port', 'host', 'https', 'allowedHosts', 'polling', 'cert', 'key'].includes(key)))) throw new Error('Unknown or invalid server setting.')
  const server = { port: 3000, host: '0.0.0.0', https: true, allowedHosts: [], polling: false, cert: 'server.crt', key: 'server.key', ...input.server }
  if (!port(server.port) || typeof server.host !== 'string' || typeof server.https !== 'boolean' || typeof server.polling !== 'boolean' || !Array.isArray(server.allowedHosts) || server.allowedHosts.some(host => typeof host !== 'string')) throw new Error('Invalid project server configuration.')
  for (const key of ['cert', 'key']) {
    if (typeof server[key] !== 'string' || !server[key]) throw new Error(`Invalid server ${key} path.`)
    server[key] = resolve(root, server[key])
  }
  const sources = new Set([file])
  const environments = {}
  for (const [name, environment] of Object.entries(input.environments)) {
    if (!record(environment) || !/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid project environment.')
    const allowed = name === 'emulator' ? ['firebaseConfig', 'sourceEnvironment', 'mode', 'portOffset', 'ports', 'readyCallable', 'region', 'seed'] : ['firebaseConfig', 'mode']
    if (Object.keys(environment).some(key => !allowed.includes(key))) throw new Error(`Unknown setting in environment ${name}.`)
    const mode = environment.mode ?? name
    if (typeof mode !== 'string' || !mode || Object.values(environments).some(other => other.mode === mode)) throw new Error('Environment modes must be distinct nonempty strings.')
    if (name === 'emulator') { environments[name] = { ...environment, mode }; continue }
    if (typeof environment.firebaseConfig !== 'string' || !environment.firebaseConfig) throw new Error(`Environment ${name} needs a Firebase SDK configuration path.`)
    const source = resolve(root, environment.firebaseConfig)
    sources.add(source)
    const configuration = readJSON(source)
    if (typeof configuration.projectId !== 'string' || !configuration.projectId) throw new Error(`Invalid Firebase project in ${source}.`)
    environments[name] = { ...environment, mode, configuration, configurationFile: source, projectId: configuration.projectId }
  }
  const emulator = environments.emulator
  if (emulator.firebaseConfig !== undefined) {
    if (typeof emulator.firebaseConfig !== 'string' || !emulator.firebaseConfig) throw new Error('Emulator firebaseConfig must be a Firebase SDK configuration path.')
    const source = resolve(root, emulator.firebaseConfig)
    sources.add(source)
    const configuration = readJSON(source)
    if (typeof configuration.projectId !== 'string' || !configuration.projectId) throw new Error(`Invalid Firebase project in ${source}.`)
    Object.assign(emulator, { configuration, configurationFile: source, projectId: configuration.projectId })
  } else {
    const origin = environments[emulator.sourceEnvironment ?? input.defaultEnvironment]
    if (!origin?.configuration || origin === emulator) throw new Error('Emulator must reference an existing SDK environment.')
    Object.assign(emulator, { configuration: origin.configuration, configurationFile: origin.configurationFile, projectId: origin.projectId })
  }
  const offset = emulator.portOffset ?? 0
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid emulator portOffset.')
  const defaults = { auth: 9099, database: 9000, functions: 5001, storage: 9199, hub: 4400, ui: 4000, logging: 4500, eventarc: 9299, tasks: 9499 }
  if (emulator.ports !== undefined && (!record(emulator.ports) || Object.keys(emulator.ports).some(key => !Object.hasOwn(defaults, key)))) throw new Error('Unknown emulator port setting.')
  const emulators = Object.fromEntries(Object.entries(defaults).map(([name, base]) => {
    const endpoint = { host: '127.0.0.1', port: base + offset, ...(emulator.ports?.[name] === undefined ? {} : { port: emulator.ports[name] }) }
    if (!port(endpoint.port) || endpoint.port + 10000 > 65535) throw new Error(`Invalid ${name} emulator port.`)
    return [name, endpoint]
  }))
  if (new Set(Object.values(emulators).map(endpoint => endpoint.port)).size !== Object.keys(emulators).length) throw new Error('Emulator ports must be distinct.')
  emulators.ui.enabled = true
  emulators.singleProjectMode = true
  if (input.testing !== undefined && (!record(input.testing) || Object.keys(input.testing).some(key => !['file', 'unitEnvironment'].includes(key)))) throw new Error('Unknown testing setting.')
  const testing = { file: 'scripts/__tests__/emulator.test.mjs', projectId: emulator.projectId, ...input.testing }
  if (typeof testing.projectId !== 'string' || typeof testing.file !== 'string' || !testing.file) throw new Error('Tests require a test file and an SDK project.')
  if (testing.unitEnvironment !== undefined && !environments[testing.unitEnvironment]) throw new Error('Unknown unit test environment.')
  const defaultEnvironment = input.defaultEnvironment
  if (!environments[defaultEnvironment]) throw new Error('Choose a configured defaultEnvironment.')
  const firebaseFile = resolve(root, 'firebase.json')
  const firebase = existsSync(firebaseFile) ? readJSON(firebaseFile) : {}
  sources.add(firebaseFile)
  if (firebase.emulators || firebase.database) throw new Error('Move emulator configuration to redequate.config.json; database Rules are generated automatically.')
  return {
    configFile: file,
    root,
    server,
    environments,
    defaultEnvironment,
    testing,
    emulators,
    firebase,
    sources: [...sources]
  }
}

export function selectProjectEnvironment(settings, name) {
  const environment = settings.environments[name]
  if (!environment) throw new Error(`Unknown project environment: ${name}`)
  return { ...settings, environment: name, configuration: environment.configuration }
}
