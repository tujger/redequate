import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { loadProjectConfig, selectProjectEnvironment } from '../app-config.mjs'
import { prepareProjectRuntime } from '../app/runtime.mjs'
import { resolveConfiguration, buildRules, watchRules } from '../firebase-rules.mjs'
import { createProjectViteConfig } from '../vite.mjs'
import { appCLI } from '../app.mjs'

const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'redequate-config-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (file, value) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value)) }
  write('package.json', { name: 'fixture', version: '1.0.1' })
  write('src/firebase-config.json', { projectId: 'configured-remote', apiKey: 'public-key' })
  write('firebase.json', { hosting: { public: 'build', rewrites: [{ source: '**', destination: '/index.html' }] }, functions: { source: 'functions' }, storage: { rules: 'storage.rules' } })
  write('storage.rules', 'rules_version = "2"; service firebase.storage {match /b/{bucket}/o {match /{path=**} {allow read: if true;}}}')
  write('functions/package.json', { private: true })
  const input = { defaultEnvironment: 'remote', server: { port: 3002, https: false, allowedHosts: ['example.lan'] }, environments: { remote: { firebaseConfig: 'src/firebase-config.json' }, emulator: { portOffset: 10 } } }
  write('redequate.config.json', input)
  return { root, write, input, file: join(root, 'redequate.config.json') }
}

const wait = async predicate => {
  const end = Date.now() + 5000
  while (!predicate()) { if (Date.now() > end) throw new Error('Timed out'); await delay(25) }
}

test('one JSON resolves all project context without environment-variable overrides', t => {
  const { root, file } = fixture(t)
  const settings = loadProjectConfig(file)
  assert.equal(settings.environments.remote.projectId, 'configured-remote')
  assert.equal(settings.server.port, 3002)
  assert.equal(settings.emulators.auth.port, 9109)
  assert.equal(settings.testing.projectId, 'configured-remote')
  assert.equal(settings.server.cert, join(root, 'server.crt'))
  assert.equal(selectProjectEnvironment(settings, 'emulator').configuration.projectId, 'configured-remote')
  assert.throws(() => selectProjectEnvironment(settings, 'missing'), /Unknown/)
})

test('no supplement means base Rules; ordinary application Rules override directives and add indexes', t => {
  const { file, write } = fixture(t)
  const base = resolveConfiguration(file).rules
  write('database.rules.json', { rules: { posts: { '.read': false, '.indexOn': ['created'] }, appOnly: { '.read': true } } })
  const composed = resolveConfiguration(file).rules
  assert.equal(composed.rules.posts['.read'], false)
  assert.equal(composed.rules.appOnly['.read'], true)
  assert(composed.rules.posts['.indexOn'].includes('created'))
  assert(composed.rules.posts['.indexOn'].includes('uid'))
  assert.equal(base.rules.posts['.read'], true)
  const output = buildRules(file)
  write('database.rules.json', '{broken')
  const previous = readFileSync(output, 'utf8')
  assert.throws(() => buildRules(file))
  assert.equal(readFileSync(output, 'utf8'), previous)
})

test('supplement creation, changes and deletion regenerate Rules without touching input', async t => {
  const { file, root, write } = fixture(t)
  const output = join(root, 'runtime/database.rules.json')
  const watcher = watchRules(file, { output, interval: 20, debounce: 10, onChange() {} })
  t.after(() => watcher.close())
  const value = () => JSON.parse(readFileSync(output, 'utf8')).rules.posts['.read']
  assert.equal(value(), true)
  write('database.rules.json', { rules: { posts: { '.read': false } } })
  await wait(() => value() === false)
  unlinkSync(join(root, 'database.rules.json'))
  await wait(() => value() === true)
})

test('generated Firebase configs preserve library settings and isolate test state', t => {
  const { file, root } = fixture(t)
  const settings = selectProjectEnvironment(loadProjectConfig(file), 'emulator')
  const runtime = prepareProjectRuntime(settings)
  t.after(() => rmSync(runtime.temporaryDirectory, { recursive: true, force: true }))
  assert.equal(runtime.config.hosting.public, join(root, 'build'))
  assert.equal(runtime.config.emulators.database.port, 9010)
  assert.equal(runtime.directory, join(root, '.firebase/emulator-data', 'configured-remote'))
  assert(existsSync(join(runtime.temporaryDirectory, runtime.config.database.rules)))
  assert(existsSync(join(runtime.temporaryDirectory, 'functions/package.json')))
  const isolated = prepareProjectRuntime(settings, { isolated: true, environment: 'emulator' })
  t.after(() => rmSync(isolated.temporaryDirectory, { recursive: true, force: true }))
  assert.equal(isolated.configuration.projectId, 'configured-remote')
  assert.equal(isolated.config.emulators.database.port, 19010)
  assert.equal(isolated.config.hosting, undefined)
  assert.equal(existsSync(join(root, '.firebase/emulator-data', 'configured-remote')), false)
})

test('Vite consumes the same JSON and emits only public runtime data', async t => {
  const { file, write } = fixture(t)
  write('vite.config.mjs', 'export default {define:{global:"globalThis"},build:{sourcemap:true}};')
  const config = await createProjectViteConfig(file, { environment: 'emulator', https: false })({ mode: 'emulator', command: 'serve' })
  assert.equal(config.server.port, 3002)
  assert.equal(config.server.proxy['/.ws'].target, 'http://127.0.0.1:9010')
  assert.equal(config.define.global, 'globalThis')
  assert.equal(config.build.sourcemap, true)
  assert(!config.plugins.some(plugin => plugin.name === 'redequate-runtime'))
  assert.equal(config.resolve.alias[0].replacement, join(file, '../src/firebase-config.json'))
  const endpoints = JSON.parse(readFileSync(join(file, '../.firebase/generated/emulators.json')))
  assert.deepEqual(Object.keys(endpoints).sort(), ['auth', 'database', 'functions', 'storage'])
  assert.equal(JSON.parse(readFileSync(join(file, '../src/firebase-config.json'))).projectId, 'configured-remote')
  write('vite.config.mjs', 'export default {server:{port:9999}};')
  await assert.rejects(createProjectViteConfig(file)({ mode: 'remote', command: 'build' }), /Move server.port/)
})

test('old config locations are not silently used and CLI validates before launching services', async t => {
  const { file, input, write } = fixture(t)
  write('firebase.json', { emulators: { database: { port: 9999 } } })
  assert.throws(() => loadProjectConfig(file), /Move emulator/)
  write('firebase.json', {})
  write('redequate.config.json', { ...input, extra: true })
  assert.throws(() => loadProjectConfig(file), /Invalid redequate/)
  write('redequate.config.json', input)
  await assert.rejects(appCLI(['--config', file, 'start', 'missing']), /Unknown/)
  await assert.rejects(appCLI(['--config', file, 'start', 'remote', '--unknown']), /Unknown/)
})
