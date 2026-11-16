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
  write('tooling/app-config.mjs', readFileSync(join(root, 'tooling/app-config.mjs')))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
  write('sdk.json', '{"projectId":"rules-watch"}')
  const config = write('redequate.config.json', JSON.stringify({ defaultEnvironment: 'remote', environments: { remote: { firebaseConfig: 'sdk.json' }, emulator: {} } }))
  const supplement = rules => write('database.rules.json', JSON.stringify({ rules }))
  const tools = await import(pathToFileURL(module).href)
  const output = join(directory, '.firebase/generated/database.rules.json')
  const read = () => JSON.parse(readFileSync(output)).rules
  return { directory, write, base, config, supplement, tools, output, read }
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

test('watcher reloads base and supplemental Rules and atomic saves; close stops updates', async t => {
  const w = await workspace(t); const events = []; const errors = []
  const watcher = w.tools.watchRules(w.config, { interval: 25, debounce: 10, onChange: event => events.push(event), onError: error => errors.push(error) })
  t.after(() => watcher.close())
  w.write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': true, '.indexOn': ['old'] } } }))
  await wait(() => w.read().records['.read'] === true)
  w.supplement({ records: { '.indexOn': ['inline'] } })
  await wait(() => w.read().records['.indexOn'].includes('inline'))
  const replacement = w.write('rules.next', '{"rules":{"records":{".indexOn":["atomic"]}}}')
  renameSync(replacement, join(w.directory, 'database.rules.json'))
  await wait(() => w.read().records['.indexOn'].includes('atomic'))
  assert.deepEqual(errors, [])
  const saved = readFileSync(w.output, 'utf8'); const count = events.length
  watcher.close(); watcher.close()
  w.supplement({})
  await delay(150)
  assert.equal(readFileSync(w.output, 'utf8'), saved)
  assert.equal(events.length, count)
})

test('watcher retains working artifact and recovers after invalid base, invalid supplement and invalid project JSON', async t => {
  const w = await workspace(t); const errors = []
  const watcher = w.tools.watchRules(w.config, { interval: 25, debounce: 10, onChange: () => {}, onError: error => errors.push(error) })
  t.after(() => watcher.close())
  const original = readFileSync(w.output, 'utf8')
  w.write('packages/database/src/firebase/database.rules.json', '{')
  await wait(() => errors.length >= 1)
  assert.equal(readFileSync(w.output, 'utf8'), original)
  w.write('packages/database/src/firebase/database.rules.json', JSON.stringify({ rules: { records: { '.read': false, '.indexOn': ['fixed'] } } }))
  await wait(() => w.read().records['.indexOn'].includes('fixed'))
  w.write('database.rules.json', '{broken')
  await wait(() => errors.length >= 2)
  assert.equal(w.read().records['.read'], false)
  w.supplement({ records: { '.indexOn': ['recovered'] } })
  await wait(() => w.read().records['.indexOn'].includes('recovered'))
  const content = readFileSync(w.config, 'utf8')
  w.write('redequate.config.json', '{broken')
  await wait(() => errors.length >= 3)
  w.write('redequate.config.json', content)
  await wait(() => w.read().records['.indexOn'].includes('recovered'))
})

test('startup errors propagate without creating a watcher or artifact', async t => {
  const w = await workspace(t)
  w.supplement({ records: { '.unknown': true } })
  assert.throws(() => w.tools.watchRules(w.config), /directive/)
  assert(!existsSync(w.output))
})

test('Vite build hook generates Rules and rejects invalid builds', async t => {
  const w = await workspace(t)
  const plugin = w.tools.firebaseRulesBuildPlugin(w.config)
  assert.equal(plugin.apply, 'build')
  plugin.buildStart()
  assert(existsSync(w.output))
  w.supplement({ records: { '.unknown': true } })
  assert.throws(() => plugin.buildStart(), /directive/)
})
