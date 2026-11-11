import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import runFirebase, { validateFirebaseConfig } from '../app/run.mjs'
import { loadProjectConfig } from '../app-config.mjs'
import { prepareProjectRuntime } from '../app/runtime.mjs'
import seedEmulator from '../app/seed.mjs'
import Processes from '../app/processes.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixture = t => {
  const directory = mkdtempSync(join(tmpdir(), 'firebase-tooling-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const write = (path, data) => { const file = join(directory, path); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data)); return file }
  write('package.json', '{"name":"fixture","private":true}')
  write('dev.json', { projectId: 'configured-dev', apiKey: 'public', databaseURL: 'https://configured-dev-default-rtdb.firebaseio.com', storageBucket: 'configured-dev.appspot.com' })
  write('prod.json', { projectId: 'configured-prod' })
  write('redequate.config.json', { defaultEnvironment: 'dev', server: { port: 3002, https: true }, testing: { file: 'scripts/__tests__/configured.test.mjs' }, environments: { dev: { firebaseConfig: 'dev.json', mode: 'server-dev' }, prod: { firebaseConfig: 'prod.json', mode: 'server-prod' }, emulator: { readyCallable: 'configuredCallable' } } })
  write('firebase.json', { functions: { source: 'functions' }, storage: { rules: 'storage.rules' } })
  write('storage.rules', 'rules_version = "2"; service firebase.storage {match /b/{bucket}/o {match /{path=**} {allow read: if false;}}}')
  write('functions/package.json', { private: true })
  return { directory, write, config: loadProjectConfig(join(directory, 'redequate.config.json')) }
}

test('validates supported actions and configured targets without application-specific identifiers', t => {
  const { config } = fixture(t)
  for (const action of ['start', 'build', 'deploy-hosting', 'deploy-functions']) assert.equal(validateFirebaseConfig(config, [action, 'dev']).environments.dev.projectId, 'configured-dev')
  assert.equal(validateFirebaseConfig(config, ['test', 'emulator']).environments.emulator.projectId, 'configured-dev')
  for (const argv of [[], ['start'], ['test', 'prod'], ['deploy-hosting', 'emulator'], ['build', 'unknown'], ['start', 'dev', 'extra']]) assert.throws(() => validateFirebaseConfig(config, argv))
  for (const change of [{ readyCallable: '../callable' }, { seed: {} }]) {
    assert.throws(() => validateFirebaseConfig({ ...config, environments: { ...config.environments, emulator: { ...config.environments.emulator, ...change } } }, ['start', 'emulator']))
  }
})

test('rejects invalid CLI and runner requests before creating process listeners or temp files', async t => {
  const { config } = fixture(t)
  const count = process.listenerCount('SIGINT')
  await assert.rejects(runFirebase(config, ['test', 'prod']))
  assert.equal(process.listenerCount('SIGINT'), count)
})

test('importing runner is inert and symlink CLI entry still executes validation', t => {
  const { directory } = fixture(t)
  const module = join(root, 'tooling/app.mjs')
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `const before = process.listenerCount('SIGINT'); await import(${JSON.stringify(module)}); if (process.listenerCount('SIGINT') !== before) throw Error('side effects'); console.log('imported');`], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /imported/)
  const link = join(directory, 'linked.mjs'); symlinkSync(module, link)
  const invalid = spawnSync(process.execPath, [link], { encoding: 'utf8', timeout: 5000 })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /Usage/)
})

test('developer and isolated runtimes preserve SDK files, source config and persistent snapshots', t => {
  const { directory, write, config } = fixture(t)
  const snapshot = write('.firebase/emulator-data/configured-dev/marker', 'keep')
  const original = readFileSync(join(directory, 'firebase.json'), 'utf8')
  const sdk = readFileSync(join(directory, 'dev.json'), 'utf8')
  for (const isolated of [false, true]) {
    const result = prepareProjectRuntime(config, { environment: 'emulator', isolated })
    t.after(() => rmSync(result.temporaryDirectory, { recursive: true, force: true }))
    assert.equal(result.configuration.projectId, 'configured-dev')
    assert.equal(result.config.emulators.database.port, isolated ? 19000 : 9000)
    assert(existsSync(join(result.temporaryDirectory, result.config.database.rules)))
    assert.equal(readFileSync(snapshot, 'utf8'), 'keep')
    assert.equal(readFileSync(join(directory, 'firebase.json'), 'utf8'), original)
    assert.equal(readFileSync(join(directory, 'dev.json'), 'utf8'), sdk)
  }
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

test('CLI readiness requires full startup and is revoked on shutdown', async () => {
  const { observeEmulatorLine, emulatorReady } = await import('../app/run.mjs')
  const task = { exited: false }
  observeEmulatorLine('functions: callable initialized', task)
  assert.equal(emulatorReady(task), false)
  observeEmulatorLine('\x1b[32mAll emulators ready!\x1b[0m', task)
  assert.equal(emulatorReady(task), true)
  observeEmulatorLine('emulators: Shutting down emulators.', task)
  assert.equal(task.shutdownStarted, true)
  assert.equal(emulatorReady(task), false)
})

test('process teardown waits for CLI cleanup without interrupting it again', async t => {
  const { directory } = fixture(t)
  const marker = join(directory, 'interrupted')
  const group = new Processes()
  let observe
  const observed = new Promise(resolve => { observe = resolve })
  const { observeEmulatorLine } = await import('../app/run.mjs')
  const script = `process.on('SIGINT', () => { require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad'); process.exit(2) }); process.stdout.write('emulators: Shutting '); setTimeout(() => { console.log('down emulators.'); setTimeout(() => process.exit(0), 200) }, 20)`
  const task = group.start(process.execPath, ['-e', script], {
    cwd: directory,
    signalGroup: false,
    onLine(line, task) { observeEmulatorLine(line, task); if (task.shutdownStarted) observe() }
  })
  try {
    await observed
    await group.stop()
    assert.equal((await task.completed).code, 0)
    assert.equal(existsSync(marker), false)
  } finally { if (!task.exited) await group.stop() }
})

const pendingLease = () => ({ completed: new Promise(() => {}), release() {} })

for (const target of ['dev', 'prod']) {
  test(`${target} starts Vite only after core readiness and releases after consumer teardown`, async t => {
    const { write, config } = fixture(t)
    write('node_modules/vite/package.json', { name: 'vite', exports: { './package.json': './package.json' } })
    let coreReady = false
    let stopped = false
    let released = false
    const calls = []
    t.mock.method(Processes.prototype, 'run', async function (command, args) {
      assert.equal(coreReady, true)
      calls.push(args)
    })
    const originalStop = Processes.prototype.stop
    t.mock.method(Processes.prototype, 'stop', async function () { stopped = true; await originalStop.call(this) })
    const startCore = async () => {
      coreReady = true
      return { ...pendingLease(), release() { assert(stopped); released = true } }
    }
    assert.equal(await runFirebase(config, ['start', target], { startCore }), 0)
    assert.equal(released, true)
    assert(calls.some(args => args.includes('server-' + target)))
    assert(!calls.some(args => args.some(arg => /emulators:start|server\/(watch|prepare)\.mjs/.test(arg))))
  })
}

test('start uses JSON server settings despite conflicting ambient HTTPS and PORT', async t => {
  const { write, config } = fixture(t)
  write('node_modules/vite/package.json', { name: 'vite', exports: { './package.json': './package.json' } })
  const previous = { HTTPS: process.env.HTTPS, PORT: process.env.PORT }
  process.env.HTTPS = 'false'; process.env.PORT = '9999'
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  const check = options => { assert.equal(options.env.HTTPS, 'true'); assert.equal(options.env.PORT, '3002') }
  t.mock.method(Processes.prototype, 'run', async (command, args, options) => check(options))
  const startCore = async (group, options) => { check(options); return pendingLease() }
  assert.equal(await runFirebase(config, ['start', 'dev'], { startCore }), 0)
})

test('initial core failure prevents Vite and local service startup', async t => {
  const { config } = fixture(t)
  let calls = 0
  const startCore = async () => { calls++; throw new Error('Initial core build failed') }
  t.mock.method(Processes.prototype, 'run', async () => { assert.fail('No consumer should start before core readiness.') })
  assert.equal(await runFirebase(config, ['start', 'emulator'], { startCore }), 1)
  assert.equal(calls, 1)
})

test('unexpected core disconnect terminates a development launcher and releases its lease', async t => {
  const { write, config } = fixture(t)
  write('node_modules/vite/package.json', { name: 'vite', exports: { './package.json': './package.json' } })
  let finishCore
  let stopped = false
  let released = false
  const startCore = async () => ({
    completed: new Promise(resolve => { finishCore = resolve }),
    release() { assert(stopped); released = true }
  })
  t.mock.method(Processes.prototype, 'run', async function (command, args) {
    if (args[0].endsWith('/vite.js')) {
      finishCore({ code: 1 })
      await this.interrupted
    }
  })
  const originalStop = Processes.prototype.stop
  t.mock.method(Processes.prototype, 'stop', async function () {
    stopped = true
    this.interrupt({ code: 1 })
    await originalStop.call(this)
  })
  assert.equal(await runFirebase(config, ['start', 'dev'], { startCore }), 1)
  assert.equal(released, true)
})

test('emulator acquires core first and owns only server watch plus local services', async t => {
  const { directory, write, config } = fixture(t)
  for (const name of ['vite', 'firebase-tools']) {
    write(`node_modules/${name}/package.json`, { name, exports: { './package.json': './package.json' } })
  }
  const calls = []
  let coreReady = false
  let released = false
  const startCore = async () => {
    calls.push(['core-lease'])
    coreReady = true
    return { ...pendingLease(), release() { released = true } }
  }
  t.mock.method(Processes.prototype, 'start', function (command, args, options) {
    calls.push(args)
    assert(coreReady)
    const task = { child: { pid: process.pid }, exited: false, completed: new Promise(() => {}) }
    if (args.includes('emulators:start')) options.onLine('All emulators ready!', task)
    return task
  })
  t.mock.method(Processes.prototype, 'run', async function (command, args) {
    assert(coreReady)
    calls.push(args)
  })
  t.mock.method(globalThis, 'fetch', async url => ({
    status: 401,
    json: async () => url.endsWith('/emulators')
      ? { functions: {}, database: {}, auth: {}, storage: {} }
      : url.endsWith('/configuredCallable')
        ? { error: { status: 'UNAUTHENTICATED' } }
        : { pid: process.pid }
  }))
  t.mock.method(Processes.prototype, 'wait', async () => ({ code: 0 }))
  const originalStop = Processes.prototype.stop
  t.mock.method(Processes.prototype, 'stop', async function () {
    write('.firebase/emulator-data/configured-dev/firebase-export-metadata.json', {})
    await originalStop.call(this)
  })
  assert.equal(await runFirebase(config, ['start', 'emulator'], { startCore }), 0)
  assert.equal(released, true)
  assert.deepEqual(calls[0], ['core-lease'])
  assert(calls.some(args => args.includes('emulators:start')))
  const server = calls.findIndex(args => args[0].endsWith('/server/watch.mjs'))
  const vite = calls.findIndex(args => args[0].endsWith('/vite.js'))
  assert(server > 0)
  assert(vite > server)
  assert.equal(readFileSync(join(directory, '.firebase/emulator-data/configured-dev/firebase-export-metadata.json'), 'utf8'), '{}')
})


test('test-unit runs JSX/jsdom tests through shared config without application Vite or Vitest files', t => {
  const { directory, write } = fixture(t)
  write('package.json', { name: 'unit-fixture', version: '1.0.0' })
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
  write('src/shared.test.js', `
    it('supports JSX, jsdom and test globals', () => {
      expect((<div>shared</div>).props.children).toBe('shared');
      expect(document.createElement('div').tagName).toBe('DIV');
      vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    });
    it('restores mocks between tests', () => {
      expect(vi.isMockFunction(Math.random)).toBe(false);
    });
  `)
  const result = spawnSync(process.execPath, [join(root, 'tooling/app.mjs'), '--config', join(directory, 'redequate.config.json'), 'test-unit'], {
    cwd: root, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory }
  })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /2 passed/)
})
