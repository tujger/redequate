import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Linter } from 'eslint'
import { baseRules, resolveRules } from '../../packages/database/src/firebase/rules.mjs'
import { resolveConfiguration, buildRules, loadRules } from '../firebase-rules.mjs'
import queries from '../eslint/database-queries.mjs'
import localStores, { storesJsonParser } from '../eslint/local-stores.mjs'

const fixture = fn => {
  const directory = mkdtempSync(join(tmpdir(), 'rules-tooling-'))
  const write = (name, source) => { const path = join(directory, name); writeFileSync(path, source); return path }
  write('sdk.json', '{"projectId":"rules-fixture"}')
  const config = () => write('redequate.config.json', JSON.stringify({ defaultEnvironment: 'remote', environments: { remote: { firebaseConfig: 'sdk.json' }, emulator: {} } }))
  const supplement = rules => write('database.rules.json', JSON.stringify({ rules }))
  try { return fn({ directory, write, supplement, config }) } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('base loads without SDK, is frozen and empty composition is equivalent', () => {
  assert(Object.isFrozen(baseRules.rules))
  assert.deepEqual(resolveRules(baseRules), baseRules)
  assert.notEqual(resolveRules(baseRules), baseRules)
  assert.deepEqual(resolveRules(baseRules, { additions: {} }), baseRules)
  assert.deepEqual(baseRules.rules.alerts.$user_id.$alert_id, {})
})

test('mutualrequests index only identity fields and validate immutable participants', () => {
  const requests = baseRules.rules.mutualrequests.$mutual_type
  assert.deepEqual(requests['.indexOn'], ['id', 'uid'])
  const validation = requests.$mutual_id['.validate']
  assert(!validation.includes('uid_id'))
  assert(!validation.includes('id_uid'))
  assert(validation.includes("newData.child('uid').val() === data.child('uid').val()"))
  assert(validation.includes("newData.child('id').val() === data.child('id').val()"))
  assert.deepEqual(baseRules.rules.mutual.$mutual_type['.indexOn'], ['id', 'uid', 'id_uid', 'uid_id'])
})

test('adds branches, unions indexes and preserves inputs and scalar indexes', () => {
  const base = { rules: { posts: { '.indexOn': ['uid'] }, roles: { '.indexOn': '.value' } } }
  const options = { additions: { posts: { '.indexOn': ['uid', 'created'] }, records: { $id: {} } } }
  const snapshot = JSON.stringify({ base, options })
  const result = resolveRules(base, options)
  assert.deepEqual(result.rules.posts['.indexOn'], ['uid', 'created'])
  assert.deepEqual(result.rules.records, { $id: {} })
  assert.equal(result.rules.roles['.indexOn'], '.value')
  assert.equal(JSON.stringify({ base, options }), snapshot)
  assert.deepEqual(resolveRules(result, options), result)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('rejects access and validation conflicts; explicit overrides acknowledge them', () => {
  for (const key of ['.read', '.write', '.validate']) {
    const base = { rules: { posts: { [key]: false } } }
    assert.throws(() => resolveRules(base, { additions: { posts: { [key]: true } } }), /conflict/)
    assert.equal(resolveRules(base, { overrides: { [`posts/${key}`]: true } }).rules.posts[key], true)
  }
})

test('rejects new inherited grants and ineffective child restrictions, including wildcard intersections', () => {
  assert.throws(() => resolveRules({ rules: { posts: { $id: { '.read': false } } } }, { additions: { posts: { '.read': true } } }), /inherited/)
  assert.throws(() => resolveRules({ rules: { posts: { '.write': true } } }, { additions: { posts: { $id: { '.write': false } } } }), /inherited/)
  assert.throws(() => resolveRules({ rules: { $id: { '.read': true } } }, { additions: { named: { '.read': false } } }), /inherited/)
  const result = resolveRules({ rules: { posts: { $id: { '.read': false } } } }, { overrides: { 'posts/.read': true } })
  assert.equal(result.rules.posts['.read'], true)
  assert.deepEqual(resolveRules(baseRules), baseRules) // legacy grants are retained
})

test('rejects invalid format, directives, keys, unsafe objects and ambiguous wildcards', () => {
  for (const base of [{}, { rules: [] }, { rules: { x: { '.unknown': true } } }, { rules: { $a: {}, $b: {} } },
    { rules: { x: { '.indexOn': [] } } }, JSON.parse('{"rules":{"__proto__":{}}}')]) {
    assert.throws(() => resolveRules(base))
  }
  assert.throws(() => resolveRules({ rules: {} }, { overrides: { x: true } }), /override/)
  assert.throws(() => resolveRules({ rules: {} }, { unexpected: true }), /option/)
})

test('builds atomically and deterministically and never leaves a partial output on failure', () => fixture(({ supplement, config, directory }) => {
  supplement({ posts: { '.indexOn': ['created'] } })
  const path = config()
  const output = buildRules(path)
  const first = readFileSync(output, 'utf8')
  assert.equal(readFileSync(buildRules(path), 'utf8'), first)
  assert.deepEqual(JSON.parse(first), resolveConfiguration(path).rules)
  assert.deepEqual(loadRules({ projectConfig: path }).rules, JSON.parse(first))
  writeFileSync(join(path, '../database.rules.json'), '{broken')
  assert.throws(() => buildRules(path))
  assert.equal(readFileSync(output, 'utf8'), first)
  assert(!existsSync(join(directory, '.firebase/generated/database.rules.json.' + process.pid + '.tmp')))
}))

test('both ESLint validators use configured composed Rules and report invalid application configuration', () => fixture(({ supplement, config }) => {
  supplement({ posts: { '.indexOn': ['created'] } })
  const path = config()
  const settings = { redequateDatabase: { projectConfig: path } }
  const queryConfig = [{
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    settings,
    plugins: { redequate: queries },
    rules: { 'redequate/database-queries': 'error' }
  }]
  const code = 'import Database from "redequate/database/firebase"; const database = new Database({}); database.read(["posts"], {orderBy: ["created"]});'
  assert.deepEqual(new Linter().verify(code, queryConfig), [])
  const stores = [{ store: 'posts', storeSchema: ['uid', 'to', 'created'].map(name => ({ name, keypath: name })) }]
  const localConfig = [{
    files: ['**/*.json'],
    languageOptions: { parser: storesJsonParser },
    settings,
    plugins: { redequate: localStores },
    rules: { 'redequate/local-stores': 'error' }
  }]
  assert.deepEqual(new Linter().verify(JSON.stringify(stores), localConfig, { filename: 'stores.json' }), [])
  writeFileSync(join(path, '../database.rules.json'), '{broken')
  assert.match(new Linter().verify(code, queryConfig)[0].message, /Cannot resolve Firebase Rules/)
  assert.match(new Linter().verify(JSON.stringify(stores), localConfig, { filename: 'stores.json' })[0].message, /Cannot read Firebase rules/)
}))

test('refuses to overwrite the project, SDK or supplement source', () => fixture(({ supplement, config, directory }) => {
  supplement({ records: { '.read': true } })
  const path = config()
  for (const source of [path, join(directory, 'sdk.json'), join(directory, 'database.rules.json')]) {
    const previous = readFileSync(source, 'utf8')
    assert.throws(() => buildRules(path, { output: source }), /overwrite a source/)
    assert.equal(readFileSync(source, 'utf8'), previous)
  }
}))

test('provider manifests are rejected rather than silently supported', () => fixture(({ write }) => {
  const file = write('database-rules.config.json', '{"providers":["App.js"]}')
  assert.throws(() => resolveConfiguration(file), /Invalid redequate/)
}))
