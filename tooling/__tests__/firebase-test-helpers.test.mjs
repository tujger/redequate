import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadFirebaseEmulatorTestConfig, createFirebaseEmulatorTestTools } from '../firebase-test.mjs'

test('test configuration rejects missing files, wrong projects and non-isolated endpoints', t => {
  const root = mkdtempSync(join(tmpdir(), 'firebase-test-helper-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = join(root, 'client.json')
  const settings = { configuration: { projectId: 'demo-fixture-test' }, emulators: Object.fromEntries(['auth', 'database', 'functions', 'storage', 'hub'].map((name, i) => [name, { host: '127.0.0.1', port: 15000 + i }])) }
  writeFileSync(file, JSON.stringify(settings))
  assert.deepEqual(loadFirebaseEmulatorTestConfig('demo-fixture-test', file), settings)
  assert.throws(() => loadFirebaseEmulatorTestConfig('production', file), /project ID/)
  assert.throws(() => loadFirebaseEmulatorTestConfig('demo-other-test', file), /project ID/)
  settings.emulators.auth.host = 'example.com'
  writeFileSync(file, JSON.stringify(settings))
  assert.throws(() => loadFirebaseEmulatorTestConfig('demo-fixture-test', file), /endpoint/)
})

test('client setup uses the supplied SDK and polling propagates results and failures', async () => {
  const app = {}
  const calls = []
  const emulators = Object.fromEntries(['auth', 'database', 'functions', 'storage'].map((name, i) => [name, { host: '127.0.0.1', port: 15000 + i }]))
  let value = null
  const sdk = { initializeApp: () => app, ref: (database, path) => path, get: async () => ({ val: () => value }), Backend: class { constructor(settings) { this.settings = settings } } }
  for (const name of ['Auth', 'Database', 'Functions', 'Storage']) {
    sdk['get' + name] = candidate => { assert.equal(candidate, app); return name }
    sdk['connect' + name + 'Emulator'] = (...args) => calls.push(args)
  }
  const tools = createFirebaseEmulatorTestTools({ configuration: {}, emulators }, sdk)
  const client = tools.client('example')
  assert.equal(client.app, app)
  assert.equal(client.backend.settings.firebase.app, app)
  assert.deepEqual(calls[0], ['Auth', 'http://127.0.0.1:15000', { disableWarnings: true }])
  assert.deepEqual(calls[1], ['Database', '127.0.0.1', 15001])
  value = 42
  assert.equal(await tools.waitFor(client.database, 'record', result => result === 42), 42)
  await assert.rejects(tools.waitFor(client.database, 'missing', () => false, { timeout: 5, interval: 1 }), /Timed out waiting for missing/)
  sdk.get = async () => { throw new Error('Read denied') }
  await assert.rejects(tools.waitFor(client.database, 'denied', () => true), /Read denied/)
})
