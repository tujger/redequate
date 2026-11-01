import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import runFirebase, { validateFirebaseConfig, firebaseCLI } from '../firebase.mjs'
import emulatorConfig from '../emulator-config.mjs'
import seedEmulator from '../seed-emulator.mjs'
import Processes from '../processes.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const settings = directory => ({
  root: directory,
  projects: { dev: 'configured-dev', prod: 'configured-prod', emulator: 'demo-configured' },
  modes: { dev: 'server-dev', prod: 'server-prod', emulator: 'emulator' },
  emulator: { clientConfig: 'config/firebase-emulator.json', testProjectId: 'demo-configured-test', readyCallable: 'configuredCallable', testFile: 'scripts/__tests__/configured.test.mjs' }
})
const fixture = t => {
  const directory = mkdtempSync(join(tmpdir(), 'firebase-tooling-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const write = (path, data) => { const file = join(directory, path); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data)); return file }
  write('package.json', '{"name":"fixture","private":true}')
  write('config/firebase-emulator.json', { projectId: 'demo-configured', apiKey: 'demo-configured', storageBucket: 'demo-configured.appspot.com' })
  write('firebase.json', {
    database: { rules: '.firebase/generated/database.rules.json' },
    storage: { rules: 'storage.rules' },
    functions: { source: 'functions' },
    emulators: { database: { host: '127.0.0.1', port: 9000 }, auth: { host: '127.0.0.1', port: 9099 }, functions: { host: '127.0.0.1', port: 5001 }, storage: { host: '127.0.0.1', port: 9199 }, hub: { host: '127.0.0.1', port: 4400 } }
  })
  write('storage.rules', 'rules_version = "2"; service firebase.storage {match /b/{bucket}/o {match /{path=**} {allow read: if false;}}}')
  write('database-rules.config.json', { providers: [{ file: 'src/App.js', binding: 'database' }], output: '.firebase/generated/database.rules.json' })
  write('src/App.js', 'import Database from "redequate/database/firebase"; const database = new Database({});')
  mkdirSync(join(directory, 'functions'))
  return { directory, write, config: settings(directory) }
}

test('validates supported actions and configured targets without application-specific identifiers', () => {
  const config = settings('/tmp/example')
  for (const action of ['start', 'build', 'deploy-hosting', 'deploy-functions']) assert.equal(validateFirebaseConfig(config, [action, 'dev']).projects.dev, 'configured-dev')
  assert.equal(validateFirebaseConfig(config, ['test', 'emulator']).emulator.testProjectId, 'demo-configured-test')
  for (const argv of [[], ['start'], ['test', 'prod'], ['deploy-hosting', 'emulator'], ['build', 'unknown'], ['start', 'dev', 'extra']]) assert.throws(() => validateFirebaseConfig(config, argv))
  for (const change of [{ testProjectId: 'production' }, { testProjectId: 'demo-configured' }, { clientConfig: '' }, { testFile: '' }, { readyCallable: '../callable' }, { seed: {} }]) {
    assert.throws(() => validateFirebaseConfig({ ...config, emulator: { ...config.emulator, ...change } }, ['start', 'emulator']))
  }
})

test('rejects invalid CLI and runner requests before creating process listeners or temp files', async () => {
  const count = process.listenerCount('SIGINT')
  await assert.rejects(runFirebase(settings('/tmp/example'), ['test', 'prod']))
  await assert.rejects(firebaseCLI([]), /Usage/)
  assert.equal(process.listenerCount('SIGINT'), count)
})

test('importing runner is inert and symlink CLI entry still executes validation', t => {
  const { directory } = fixture(t)
  const module = join(root, 'tooling/firebase.mjs')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const before = process.listenerCount('SIGINT'); await import(${JSON.stringify(module)}); if (process.listenerCount('SIGINT') !== before) throw Error('side effects'); console.log('imported');`], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /imported/)
  const link = join(directory, 'linked.mjs'); symlinkSync(module, link)
  const invalid = spawnSync(process.execPath, [link], { encoding: 'utf8', timeout: 5000 })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /Usage/)
})

test('developer configuration generates Rules and preserves its snapshot', t => {
  const { directory, write, config } = fixture(t)
  const snapshot = write('.firebase/emulator-data/marker', 'keep')
  const original = readFileSync(join(directory, 'firebase.json'), 'utf8')
  const result = emulatorConfig(config)
  assert.equal(result.directory, join(directory, '.firebase/emulator-data'))
  assert(existsSync(join(directory, result.config.database.rules)))
  assert.equal(readFileSync(snapshot, 'utf8'), 'keep')
  assert.equal(readFileSync(join(directory, 'firebase.json'), 'utf8'), original)
})

test('isolated configuration uses configured demo project, independent ports and disposable Rules', t => {
  const { directory, write, config } = fixture(t)
  const marker = write('.firebase/emulator-data/marker', 'keep')
  const result = emulatorConfig(config, { isolated: true })
  t.after(() => rmSync(result.temporaryDirectory, { recursive: true, force: true }))
  assert.equal(result.configuration.projectId, 'demo-configured-test')
  assert.equal(result.configuration.databaseURL, 'https://demo-configured-test-default-rtdb.firebaseio.com')
  assert.notEqual(result.directory, join(directory, '.firebase/emulator-data'))
  assert(result.runtimeDirectory.startsWith(result.temporaryDirectory))
  assert.equal(result.config.emulators.database.port, 19000)
  for (const name of ['auth', 'database', 'functions', 'storage', 'hub', 'logging', 'eventarc', 'tasks']) assert(result.config.emulators[name].port >= 10000)
  assert.equal(readFileSync(marker, 'utf8'), 'keep')
  assert(existsSync(join(result.temporaryDirectory, result.config.database.rules)))
  assert(!existsSync(join(directory, result.config.database.rules)))
})

test('invalid project and unsafe Rules paths fail without escaping the temporary directory', t => {
  const { write, config } = fixture(t)
  write('config/firebase-emulator.json', { projectId: 'demo-another' })
  assert.throws(() => emulatorConfig(config), /Unexpected/)
  write('config/firebase-emulator.json', { projectId: 'demo-configured' })
  const firebase = JSON.parse(readFileSync(join(config.root, 'firebase.json')))
  firebase.database.rules = '../escape.json'; write('firebase.json', firebase)
  assert.throws(() => emulatorConfig(config, { isolated: true }), /escapes/)
  assert(!existsSync(join(config.root, 'escape.json')))
})

const account = { localId: 'fixture-admin', email: 'fixture@example.test', displayName: 'Fixture Admin', role: 'admin' }
const urls = { database: 'http://127.0.0.1:19000', auth: 'http://127.0.0.1:19099' }

test('seed rejects non-demo projects and non-loopback URLs before making requests', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('unexpected request') })
  for (const options of [{ project: 'production' }, { urls: { ...urls, database: 'https://example.com' } }, { urls: { ...urls, auth: 'http://user@127.0.0.1:9099' } }]) {
    await assert.rejects(seedEmulator({ project: 'demo-configured', urls, accounts: [account], password: 'fixture-password', ...options }))
  }
  assert.equal(calls, 0)
})

test('seed creates configured accounts and role data then skips an existing marker', async t => {
  const calls = []
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url, options })
    return { ok: true, status: 200, json: async () => url.includes('emulatorSeed') ? null : url.includes('batchGet') ? { users: [] } : {} }
  })
  await seedEmulator({ project: 'demo-configured-test', urls, accounts: [account], password: 'fixture-password' })
  const created = calls.find(call => call.options.method === 'POST')
  assert.equal(JSON.parse(created.options.body).email, account.email)
  const saved = JSON.parse(calls.find(call => call.options.method === 'PATCH').options.body)
  assert.equal(saved['roles/fixture-admin'], 'admin')
  assert.equal(saved['meta/emulatorSeed'], 1)
  assert(calls.every(call => call.url.includes('demo-configured-test')))
  calls.length = 0
  fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => 1 }))
  await seedEmulator({ project: 'demo-configured-test', urls, accounts: [account], password: 'fixture-password' })
  assert.equal(fetch.mock.callCount(), 5)
})

test('process manager removes its own signal handlers even after a failed child', async () => {
  const count = process.listenerCount('SIGINT')
  const group = new Processes()
  try { await assert.rejects(group.run(process.execPath, ['-e', 'process.exit(3)'], { cwd: root }), /exited with 3/) } finally { await group.stop() }
  assert.equal(process.listenerCount('SIGINT'), count)
})
