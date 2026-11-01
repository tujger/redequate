import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, rmSync, statSync, renameSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../../', import.meta.url))
const wait = async predicate => {
  const deadline = Date.now() + 5000
  while (!predicate()) { if (Date.now() >= deadline) throw Error('Watcher update timed out'); await delay(25) }
}
async function workspace(t) {
  const directory = mkdtempSync(join(tmpdir(), 'rules-watch-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const write = (path, value) => { const file = join(directory, path); mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, value); return file }
  const base = write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': false, '.write': false, '.indexOn': ['old'] } } }))
  copyFileSync(join(root, 'packages/database/src/firebase/rules.mjs'), join(directory, 'packages/database/src/firebase/rules.mjs'))
  const module = write('tooling/firebase-rules.mjs', readFileSync(join(root, 'tooling/firebase-rules.mjs')))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
  const config = write('rules.config.json', JSON.stringify({ providers: [{ file: 'App.js', binding: 'database' }], output: 'generated/rules.json' }))
  const app = options => write('App.js', `import Database from "redequate/database/firebase"; const database = new Database({rules: ${options}});`)
  app('{}')
  const tools = await import(pathToFileURL(module).href)
  const output = join(directory, 'generated/rules.json')
  const read = () => JSON.parse(readFileSync(output)).rules
  return { directory, write, base, config, app, tools, output, read }
}

test('fresh base reads, deterministic no-op builds and alternate output', async t => {
  const w = await workspace(t)
  w.tools.buildRules(w.config)
  const modified = statSync(w.output).mtimeMs
  await delay(30)
  w.tools.buildRules(w.config)
  assert.equal(statSync(w.output).mtimeMs, modified)
  w.write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': true } } }))
  w.tools.buildRules(w.config)
  assert.equal(w.read().records['.read'], true)
  const alternative = join(w.directory, 'isolated/rules.json')
  assert.equal(w.tools.buildRules(w.config, { output: alternative }), alternative)
  assert.deepEqual(JSON.parse(readFileSync(alternative)), { rules: w.read() })
})

test('watcher reloads base, inline and imported options and atomic saves; close stops updates', async t => {
  const w = await workspace(t); const events = []; const errors = []
  const watcher = w.tools.watchRules(w.config, { interval: 25, debounce: 10, onChange: event => events.push(event), onError: error => errors.push(error) })
  t.after(() => watcher.close())
  w.write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': true, '.indexOn': ['old'] } } }))
  await wait(() => w.read().records['.read'] === true)
  w.app('{additions: {records: {".indexOn": ["inline"]}}}')
  await wait(() => w.read().records['.indexOn'].includes('inline'))
  w.write('options.json', '{"additions":{"records":{".indexOn":["imported"]}}}')
  w.write('App.js', 'import Database from "redequate/database/firebase"; import options from "./options.json"; const database = new Database({rules: options});')
  await wait(() => w.read().records['.indexOn'].includes('imported'))
  const replacement = w.write('options.next', '{"additions":{"records":{".indexOn":["atomic"]}}}')
  renameSync(replacement, join(w.directory, 'options.json'))
  await wait(() => w.read().records['.indexOn'].includes('atomic'))
  assert.deepEqual(errors, [])
  const saved = readFileSync(w.output, 'utf8'); const count = events.length
  watcher.close(); watcher.close()
  w.write('options.json', '{}')
  await delay(150)
  assert.equal(readFileSync(w.output, 'utf8'), saved)
  assert.equal(events.length, count)
})

test('watcher retains working artifact and recovers after base syntax, conflicts and missing imports', async t => {
  const w = await workspace(t); const errors = []
  const watcher = w.tools.watchRules(w.config, { interval: 25, debounce: 10, onChange: () => {}, onError: error => errors.push(error) })
  t.after(() => watcher.close())
  const original = readFileSync(w.output, 'utf8')
  w.write('packages/database/src/firebase/database.rules.json', '{')
  await wait(() => errors.length >= 1)
  assert.equal(readFileSync(w.output, 'utf8'), original)
  w.write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': false, '.indexOn': ['fixed'] } } }))
  await wait(() => w.read().records['.indexOn'].includes('fixed'))
  w.app('{additions: {records: {".read": true}}}')
  await wait(() => errors.some(error => /conflict/.test(error.message)))
  assert.equal(w.read().records['.read'], false)
  w.write('App.js', 'import Database from "redequate/database/firebase"; import options from "./missing"; const database = new Database({rules: options});')
  await wait(() => errors.some(error => /ENOENT/.test(error.message)))
  w.write('missing.js', 'export default {additions: {records: {".indexOn": ["recovered"]}}};')
  await wait(() => w.read().records['.indexOn'].includes('recovered'))
  const content = JSON.parse(readFileSync(w.config)); content.output = 'changed/rules.json'
  writeFileSync(w.config, JSON.stringify(content))
  await wait(() => errors.some(error => /restart/.test(error.message)))
  assert(!existsSync(join(w.directory, 'changed/rules.json')))
})

test('startup errors propagate without creating a watcher or artifact', async t => {
  const w = await workspace(t)
  w.app('{additions: {records: {".read": true}}}')
  assert.throws(() => w.tools.watchRules(w.config), /conflict/)
  assert(!existsSync(w.output))
})

test('Vite build hook generates Rules and rejects invalid builds', async t => {
  const w = await workspace(t)
  const plugin = w.tools.firebaseRulesBuildPlugin(w.config)
  assert.equal(plugin.apply, 'build')
  plugin.buildStart()
  assert(existsSync(w.output))
  w.app('{additions: {records: {".read": true}}}')
  assert.throws(() => plugin.buildStart(), /conflict/)
})
