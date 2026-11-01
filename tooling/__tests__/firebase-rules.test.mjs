import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Linter } from 'eslint'
import { baseRules, resolveRules } from '../../packages/database/src/firebase/rules.mjs'
import { extractRules, resolveConfiguration, buildRules, loadRules } from '../firebase-rules.mjs'
import queries from '../eslint-database-queries.mjs'
import localStores, { storesJsonParser } from '../eslint-local-stores.mjs'

const fixture = fn => {
  const directory = mkdtempSync(join(tmpdir(), 'rules-tooling-'))
  const write = (name, source) => { const path = join(directory, name); writeFileSync(path, source); return path }
  const app = source => write('App.js', `import Database from "redequate/database/firebase"; ${source}`)
  const config = providers => write('rules.config.json', JSON.stringify({ providers: providers ?? [{ file: 'App.js', binding: 'database' }], output: 'generated/rules.json' }))
  try { return fn({ directory, write, app, config }) } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('base loads without SDK, is frozen and empty composition is equivalent', () => {
  assert(Object.isFrozen(baseRules.rules))
  assert.deepEqual(resolveRules(baseRules), baseRules)
  assert.notEqual(resolveRules(baseRules), baseRules)
  assert.deepEqual(resolveRules(baseRules, { additions: {} }), baseRules)
  assert.deepEqual(baseRules.rules.alerts.$user_id.$alert_id, {})
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

test('extracts inline literals without executing App.js, even when SDK setup is dynamic', () => fixture(({ app }) => {
  const file = app('throw new Error("must not execute"); const database = new Database({firebase: initializeSDK(), rules: {additions: {posts: {".indexOn": ["created"]}}}});')
  assert.deepEqual(extractRules(file, 'database'), { additions: { posts: { '.indexOn': ['created'] } } })
}))

test('supports imported JSON, exported constants and static spread', () => fixture(({ app, write }) => {
  write('indexes.json', '["created"]')
  write('options.mjs', 'import fields from "./indexes.json"; export const options = {additions: {posts: {".indexOn": fields}}};')
  const file = app('import {options} from "./options.mjs"; const database = new Database({rules: {...options}});')
  assert.deepEqual(extractRules(file, 'database').additions.posts['.indexOn'], ['created'])
}))

test('rejects dynamic expressions, duplicate properties, cycles and unknown providers', () => fixture(({ app, write }) => {
  for (const source of ['const database = new Database({rules: getRules()});', 'const database = new Database({rules: flag ? {} : {}});',
    'let options = {}; const database = new Database({rules: options});', 'const database = new Database({rules: {}, rules: {}});',
    'const database = new OtherDatabase({rules: {}});',
    'const options = {}; options.additions = {}; const database = new Database({rules: options});',
    'const options = {}; const alias = options; alias.x = 1; const database = new Database({rules: options});',
    'const options = {}; mutate(options); const database = new Database({rules: options});',
    'const options = {}; const {a} = options; mutate(a); const database = new Database({rules: options});',
    'const options = {}; const container = {options}; container.options.x = 1; const database = new Database({rules: options});']) assert.throws(() => extractRules(app(source), 'database'))
  write('cycle.mjs', 'import {options} from "./cycle.mjs"; export {options};')
  assert.throws(() => extractRules(app('import {options} from "./cycle.mjs"; const database = new Database({rules: options});'), 'database'), /cyclic/)
}))

test('builds atomically and deterministically and never leaves a partial output on failure', () => fixture(({ app, config, directory }) => {
  app('const database = new Database({rules: {additions: {posts: {".indexOn": ["created"]}}}});')
  const path = config()
  const output = buildRules(path)
  const first = readFileSync(output, 'utf8')
  assert.equal(readFileSync(buildRules(path), 'utf8'), first)
  assert.deepEqual(JSON.parse(first), resolveConfiguration(path).rules)
  assert.deepEqual(loadRules({ rulesConfig: path }).rules, JSON.parse(first))
  app('const database = new Database({rules: dynamic()});')
  assert.throws(() => buildRules(path), /dynamic/)
  assert.equal(readFileSync(output, 'utf8'), first)
  assert(!existsSync(join(directory, 'generated/rules.json.' + process.pid + '.tmp')))
}))

test('shared database sources are complete, ordered, conflict checked and required', () => fixture(({ app, write, config }) => {
  app('const database = new Database({rules: {overrides: {"users_public/.read": false}}});')
  write('Other.js', 'import Database from "redequate/database/firebase"; const database = new Database({rules: {overrides: {"users_public/.read": true}}});')
  assert.throws(() => resolveConfiguration(config([{ file: 'App.js', binding: 'database' }, { file: 'Other.js', binding: 'database' }])), /Conflicting application/)
  assert.throws(() => resolveConfiguration(config([{ file: 'Missing.js', binding: 'database' }])), /ENOENT/)
  assert.throws(() => resolveConfiguration(config([])), /every application/)
  assert.throws(() => loadRules({ rulesConfig: 'a', firebaseRules: 'b' }), /not both/)
}))

test('both ESLint validators use provider base Rules independently of application additions', () => fixture(({ app, config }) => {
  app('const database = new Database({rules: {additions: {posts: {".indexOn": ["created"]}}}});')
  const path = config()
  const settings = { redequateDatabase: { rulesConfig: path } }
  const queryConfig = [{
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    settings,
    plugins: { redequate: queries },
    rules: { 'redequate/database-queries': 'error' }
  }]
  const code = 'import Database from "redequate/database/firebase"; const database = new Database({}); database.read(["posts"], {orderBy: ["created"]});'
  assert.match(new Linter().verify(code, queryConfig)[0].message, /No Firebase .indexOn for created/)
  const stores = [{ store: 'posts', storeSchema: ['uid', 'to', 'created'].map(name => ({ name, keypath: name })) }]
  const localConfig = [{
    files: ['**/*.json'],
    languageOptions: { parser: storesJsonParser },
    settings,
    plugins: { redequate: localStores },
    rules: { 'redequate/local-stores': 'error' }
  }]
  assert.match(new Linter().verify(JSON.stringify(stores), localConfig, { filename: 'stores.json' })[0].message, /no matching Firebase/)
  app('const database = new Database({rules: dynamic()});')
  assert.match(new Linter().verify(code, queryConfig)[0].message, /No Firebase .indexOn for created/)
  assert.match(new Linter().verify(JSON.stringify(stores), localConfig, { filename: 'stores.json' })[0].message, /no matching Firebase/)
}))

test('refuses to overwrite imported source JSON', () => fixture(({ app, write, config, directory }) => {
  write('options.json', '{}')
  app('import options from "./options.json"; const database = new Database({rules: options});')
  const path = config()
  const content = JSON.parse(readFileSync(path, 'utf8'))
  content.output = 'options.json'
  writeFileSync(path, JSON.stringify(content))
  assert.throws(() => buildRules(path), /overwrite a source/)
  assert.equal(readFileSync(join(directory, 'options.json'), 'utf8'), '{}')
}))
