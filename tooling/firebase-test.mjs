import { readFileSync } from 'node:fs'
import { loadProjectConfig } from './app-config.mjs'
import { setTimeout as delay } from 'node:timers/promises'

export function loadFirebaseEmulatorTestConfig(expectedProjectId, file = process.env.FIREBASE_EMULATOR_TEST_CONFIG) {
  if (!file) throw new Error('Run through the application "test emulator" command to isolate the suite.')
  if (expectedProjectId === undefined && process.env.REDEQUATE_CONFIG) expectedProjectId = loadProjectConfig(process.env.REDEQUATE_CONFIG).testing.projectId
  const settings = JSON.parse(readFileSync(file, 'utf8'))
  if (process.env.REDEQUATE_CONFIG && settings.isolated !== true) throw new Error('Expected an isolated test runtime.')
  if (!expectedProjectId || settings.configuration?.projectId !== expectedProjectId) throw new Error('Unexpected isolated emulator project ID.')
  for (const name of ['auth', 'database', 'functions', 'storage', 'hub']) {
    const service = settings.emulators?.[name]
    if (service?.host !== '127.0.0.1' || !Number.isInteger(service.port) || service.port < 10000 || service.port > 65535) throw new Error(`Invalid isolated ${name} emulator endpoint.`)
  }
  return settings
}

/** Use the caller's SDK functions, so linked packages cannot create duplicate SDK classes. */
export function createFirebaseEmulatorTestTools({ configuration, emulators }, sdk) {
  const client = name => {
    const app = sdk.initializeApp(configuration, name)
    const auth = sdk.getAuth(app)
    const database = sdk.getDatabase(app)
    const functions = sdk.getFunctions(app)
    const storage = sdk.getStorage(app)
    sdk.connectAuthEmulator(auth, `http://${emulators.auth.host}:${emulators.auth.port}`, { disableWarnings: true })
    sdk.connectDatabaseEmulator(database, emulators.database.host, emulators.database.port)
    sdk.connectFunctionsEmulator(functions, emulators.functions.host, emulators.functions.port)
    sdk.connectStorageEmulator(storage, emulators.storage.host, emulators.storage.port)
    return { app, auth, database, functions, storage, backend: new sdk.Backend({ firebase: { app } }) }
  }
  const waitFor = async (database, path, predicate, { timeout = 30000, interval = 200 } = {}) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const value = (await sdk.get(sdk.ref(database, path))).val()
      if (predicate(value)) return value
      await delay(interval)
    }
    throw new Error(`Timed out waiting for ${path}`)
  }
  return { client, waitFor }
}
