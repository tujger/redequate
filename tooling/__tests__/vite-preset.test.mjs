import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProjectViteConfig } from '../vite.mjs'

const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'redequate-vite-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (file, value) => { mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), typeof value === 'string' ? value : JSON.stringify(value)) }
  write('package.json', { name: 'preset-fixture', version: '1.2.3' })
  write('src/firebase-config.json', { projectId: 'preset' })
  write('prod.json', { projectId: 'preset-prod' })
  write('redequate.config.json', { defaultEnvironment: 'remote', server: { port: 3002, https: true, allowedHosts: ['example.lan'] }, environments: { remote: { firebaseConfig: 'src/firebase-config.json' }, prod: { firebaseConfig: 'prod.json' }, emulator: { portOffset: 10 } } })
  return { root, write, configure: selection => createProjectViteConfig(join(root, 'redequate.config.json'), selection) }
}

test('preset keeps PWA, version, dedupe and remote defaults without sibling assumptions', async t => {
  const { root, configure } = fixture(t)
  const config = await configure()({ mode: 'remote', command: 'build' })
  assert.equal(config.build.sourcemap, true)
  assert.equal(config.build.outDir, 'build')
  assert.equal(config.server.port, 3002)
  assert.equal(config.server.proxy, undefined)
  assert.equal(config.define['process.env.REACT_APP_VERSION'], '"1.2.3"')
  assert.equal(config.resolve.alias[0].replacement, join(root, 'src/firebase-config.json'))
  assert(config.resolve.dedupe.includes('react'))
  assert(!config.resolve.dedupe.includes('vite'))
  assert(config.plugins.flat().some(plugin => plugin.name === 'vite-plugin-pwa'))
  assert.equal(config.plugins.find(plugin => plugin.name === 'redequate-firebase-rules').apply, 'build')
  assert.equal(config.worker.format, 'es')
})

test('emulator proxy and HTTPS come from project JSON and preview shares server settings', async t => {
  const { root, write, configure } = fixture(t)
  write('server.crt', 'fixture cert')
  write('server.key', 'fixture key')
  const config = await configure({ environment: 'emulator' })({ mode: 'emulator', command: 'serve' })
  assert.equal(config.server.port, 3002)
  assert.equal(config.server.https.cert.toString(), 'fixture cert')
  assert.deepEqual(config.server.allowedHosts, ['example.lan'])
  assert.equal(config.server.proxy['/preset/'].target, 'http://127.0.0.1:5011')
  assert.equal(config.server.proxy['/.ws'].ws, true)
  assert.equal(config.server.proxy['/v0/'].target, 'http://127.0.0.1:9209')
  assert.equal(config.server.headers['Content-Security-Policy'], 'upgrade-insecure-requests')
  assert.equal(config.resolve.alias[0].replacement, join(root, 'src/firebase-config.json'))
  assert.equal(config.preview.port, config.server.port)
  assert.equal(config.preview.https, config.server.https)
})

test('library customizations and environment SDK selection survive project preset composition', async t => {
  const { root, write, configure } = fixture(t)
  write('vite.config.mjs', 'export default {define:{global:"globalThis"},build:{sourcemap:true}}')
  for (const [environment, sdk] of [['remote', 'src/firebase-config.json'], ['prod', 'prod.json'], ['emulator', 'src/firebase-config.json']]) {
    const config = await configure({ environment })({ mode: 'test', command: 'serve' })
    assert.equal(config.define.global, 'globalThis')
    assert.equal(config.build.sourcemap, true)
    assert.equal(config.server.https, undefined)
    assert.equal(config.resolve.alias[0].replacement, join(root, sdk))
  }
  await assert.rejects(configure({ environment: 'unknown' })({ mode: 'remote', command: 'build' }), /Unknown project environment/)
})


test('shared config includes unit defaults only in test mode without local config files', async t => {
  const { root, configure } = fixture(t)
  const config = await configure()({ mode: 'test', command: 'serve' })
  assert.equal(config.root, root + '/')
  assert.equal(config.define.global, 'globalThis')
  assert.equal(config.build.sourcemap, true)
  assert.equal(config.server.https, undefined)
  assert.deepEqual(config.test, { environment: 'jsdom', globals: true, include: ['src/**/*.test.js'], restoreMocks: true })
  const alias = config.resolve.alias.find(entry => entry.find instanceof RegExp && entry.find.test('redequate'))
  assert(alias.replacement.endsWith('/core/index.es.js'))
  assert.equal(alias.find.test('redequate/database/local'), false)
  const normal = await configure()({ mode: 'remote', command: 'build' })
  assert.equal(normal.test, undefined)
})

test('optional Vite customizations can still disable source maps', async t => {
  const { write, configure } = fixture(t)
  write('vite.config.mjs', 'export default {build:{sourcemap:false}}')
  const config = await configure()({ mode: 'remote', command: 'build' })
  assert.equal(config.build.sourcemap, false)
})
