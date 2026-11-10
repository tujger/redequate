import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectConfig, selectProjectEnvironment } from '../app-config.mjs'
import { readBuild, recordBuild } from '../app/build.mjs'
import { appCLI } from '../app.mjs'
import runFirebase from '../app/run.mjs'
import Processes from '../app/processes.mjs'

const fixture = t => {
  const root = mkdtempSync(join(tmpdir(), 'redequate-build-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const write = (name, data) => { mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), typeof data === 'string' ? data : JSON.stringify(data)) }
  write('package.json', { name: 'fixture' })
  write('.firebase/generated/database.rules.json', { rules: { records: { '.read': false } } })
  write('dev.json', { projectId: 'configured-dev' })
  write('prod.json', { projectId: 'configured-prod' })
  write('firebase.json', { hosting: { public: 'build' } })
  const config = { defaultEnvironment: 'dev', environments: { dev: { firebaseConfig: 'dev.json' }, prod: { firebaseConfig: 'prod.json' }, emulator: {} } }
  write('redequate.config.json', config)
  for (const name of ['vite', 'firebase-tools']) write(`node_modules/${name}/package.json`, { name, exports: { './package.json': './package.json' } })
  return { root, write, config, file: join(root, 'redequate.config.json'), settings: loadProjectConfig(join(root, 'redequate.config.json')) }
}

test('missing, corrupt and mismatched build receipts reject use of an unconfirmed artifact', async t => {
  const { write, settings, file } = fixture(t)
  assert.throws(() => readBuild(settings), /No confirmed build/)
  await assert.rejects(appCLI(['--config', file, 'preview']), /No confirmed build/)
  write('build/index.html', 'prod output')
  recordBuild(settings, 'prod')
  assert.equal(readBuild(settings).environment, 'prod')
  write('prod.json', { projectId: 'another-project' })
  assert.throws(() => readBuild(loadProjectConfig(file)), /no longer matches/)
  write('build/.redequate-build.json', '{bad')
  assert.throws(() => readBuild(settings), /No confirmed build/)
})

test('a build invalidates the previous receipt and records only a successful completed result', async t => {
  const { write, root, settings } = fixture(t)
  write('build/index.html', 'old dev')
  recordBuild(settings, 'dev')
  let fail = true
  t.mock.method(Processes.prototype, 'run', async (command, args) => {
    assert(args.includes('build'))
    assert.equal(existsSync(join(root, 'build/.redequate-build.json')), false)
    if (fail) throw new Error('Compilation failed')
    write('build/index.html', 'new prod')
  })
  assert.equal(await runFirebase(selectProjectEnvironment(settings, 'prod'), ['build', 'prod']), 1)
  assert.throws(() => readBuild(settings), /No confirmed build/)
  fail = false
  assert.equal(await runFirebase(selectProjectEnvironment(settings, 'prod'), ['build', 'prod']), 0)
  assert.equal(readBuild(settings).version, 2)
  assert.equal(readBuild(settings).environment, 'prod')
  assert.equal(readBuild(settings).projectId, 'configured-prod')
  assert.match(readBuild(settings).rulesSha256, /^[a-f0-9]{64}$/)
})

test('serve and deploy consume the same prod artifact without building or preparing unrelated services', async t => {
  const { write, root, settings, file } = fixture(t)
  write('build/index.html', 'unchanged prod bundle')
  recordBuild(settings, 'prod')
  write('database.rules.json', '{invalid: not needed to publish Hosting}')
  const calls = []
  t.mock.method(Processes.prototype, 'run', async (command, args) => {
    calls.push(args)
    assert(!args.includes('build'))
    if (args.includes('deploy')) {
      assert.equal(args[args.indexOf('--project') + 1], 'configured-prod')
      assert(['database', 'hosting'].includes(args[args.indexOf('--only') + 1]))
      const generated = JSON.parse(readFileSync(args[args.indexOf('--config') + 1]))
      assert.deepEqual(Object.keys(generated), ['hosting', 'database'])
      assert.deepEqual(JSON.parse(readFileSync(join(generated.hosting.public, '.redequate-rules.json'))), { rules: { records: { '.read': false } } })
      assert.equal(generated.hosting.public, join(root, 'build'))
      assert(generated.hosting.ignore.includes('.redequate-build.json'))
    } else {
      assert(args.includes('preview'))
      assert.equal(args[args.indexOf('--mode') + 1], 'prod')
    }
  })
  assert.equal(await appCLI(['--config', file, 'preview']), 0)
  assert.equal(await appCLI(['--config', file, 'deploy-hosting']), 0)
  assert.equal(calls.length, 3)
  assert.equal(calls[1][calls[1].indexOf('--only') + 1], 'database')
  assert.equal(calls[2][calls[2].indexOf('--only') + 1], 'hosting')
  assert.equal(readFileSync(join(root, 'build/index.html'), 'utf8'), 'unchanged prod bundle')
  await assert.rejects(appCLI(['--config', file, 'deploy-hosting', 'dev']), /do not specify/)
})

test('failed Rules publication prevents Hosting and a changed snapshot is rejected', async t => {
  const { write, root, settings, file } = fixture(t)
  write('build/index.html', 'ready')
  recordBuild(settings, 'prod')
  const calls = []
  t.mock.method(Processes.prototype, 'run', async (command, args) => {
    calls.push(args)
    assert.equal(args[args.indexOf('--only') + 1], 'database')
    throw new Error('Rules rejected')
  })
  assert.equal(await appCLI(['--config', file, 'deploy-hosting']), 1)
  assert.equal(calls.length, 1)
  assert.equal(readBuild(settings).environment, 'prod')
  write('build/.redequate-rules.json', '{}')
  await assert.rejects(appCLI(['--config', file, 'deploy-hosting']), /snapshot changed/)
  assert.equal(calls.length, 1)
  assert.equal(readFileSync(join(root, 'build/index.html'), 'utf8'), 'ready')
})
