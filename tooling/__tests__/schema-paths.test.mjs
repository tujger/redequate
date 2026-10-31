import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Linter } from 'eslint'
import { analyzePath, UNKNOWN } from '../schema-paths.mjs'
import plugin from '../eslint-database-queries.mjs'

const stores = JSON.parse(readFileSync(new URL('../../packages/database/src/local/stores.json', import.meta.url)))
const rules = JSON.parse(readFileSync(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)))
const local = (path, options) => analyzePath({ path, options, provider: 'local', stores })
const firebase = (path, options) => analyzePath({ path, options, provider: 'firebase', rules })
const codes = diagnostics => diagnostics.map(item => item.code)
const apply = (source, suggestion) => source.slice(0, suggestion.fix.range[0]) + suggestion.fix.text + source.slice(suggestion.fix.range[1])

test('Local treats every orderBy array as one nested field path', () => {
  for (const orderBy of ['to', ['to']]) assert.deepEqual(local(['posts', 'post_id'], { orderBy }), [])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: ['uid', 'to'] })), ['orderBy'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: ['not_indexed'] })), ['orderBy'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: ['nested', 'score'] })), ['orderBy'])
  assert.deepEqual(local(['chats', { chat_id: 'c1' }, 'message_id'], { orderBy: ['created'], start: 1 }), [])
  assert.deepEqual(codes(local(['chats', 'message_id'], { orderBy: 'created', start: 1 })), ['range'])
  assert.deepEqual(local(['chats', { chat_id: UNKNOWN }, 'message_id'], { orderBy: ['created'], start: UNKNOWN }), [])
  assert.deepEqual(local(['posts', 'post_id'], { orderBy: UNKNOWN }), [])
})

test('Local checks path segments independently of options', () => {
  assert.deepEqual(codes(local(['posts', { missing: 'x' }, 'post_id'])), ['index'])
  assert.deepEqual(codes(local(['posts', 'wrong_id'])), ['identity'])
  assert.deepEqual(local(['posts', { post_id: 'x' }, { body: 'body' }]), [])
  assert.deepEqual(local(['posts', { post_id: UNKNOWN }, { body: 'body' }]), [])
  assert.deepEqual(codes(local(['posts', ''], { orderBy: ['to'] })), ['path'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: [''] })), ['orderBy-path'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: 3 })), ['orderBy-path'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { order: 'sideways' })), ['order'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { start: 1 })), ['key-bound'])
  assert.deepEqual(codes(local(['posts', 'post_id'], { orderBy: 'to', equalTo: 1, start: 2 })), ['bounds'])
  assert.deepEqual(local(['posts', 'post_id'], { orderBy: ['to'], start: UNKNOWN }), [])
})

test('Firebase uses one orderByChild path and the query node index', () => {
  assert.deepEqual(firebase(['database_test', 'record_id'], { orderBy: 'to' }), [])
  assert.deepEqual(firebase(['database_test', 'record_id'], { orderBy: ['to'] }), [])
  assert.deepEqual(firebase(['database_test', 'record_id'], { orderBy: ['nested', 'name'] }), [])
  assert.deepEqual(codes(firebase(['database_test', 'record_id'], { orderBy: ['to', 'score'] })), ['firebase-index'])
  assert.deepEqual(codes(firebase(['database_test', 'record_id'], { orderBy: 'missing' })), ['firebase-index'])
  assert.deepEqual(firebase(['database_test', 'record_id'], { orderBy: UNKNOWN }), [])
  assert.deepEqual(firebase(['users_private', { user_id: 'u' }], {}), [])
})

const lint = (source, settings = {}) => new Linter().verify(source, [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: { redequate: plugin },
  rules: { 'redequate/database-queries': 'error' },
  settings
}], { filename: 'example.js' })

test('ESLint reports precise Local fields and skips dynamic or unknown providers', () => {
  const header = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  assert.equal(lint(header + 'db.read(["posts", "post_id"], {orderBy: ["to"]});').length, 0)
  const bad = lint(header + 'db.read(["posts", "post_id"], {orderBy: ["uid", "to"]});')
  assert.equal(bad.length, 1)
  assert.match(bad[0].message, /No Local index.*uid\/to.*Available fields/)
  assert.equal(lint(header + 'db.read(["posts", "post_id"], {orderBy: field});').length, 0)
  assert.equal(lint(header + 'db.read(dynamicPath, {orderBy: ["missing"]});').length, 0)
  assert.equal(lint('database.read(["posts"], {orderBy: ["missing"]});').length, 0)
  assert.equal(lint('import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase({stores: customStores}); db.read(["custom"], {orderBy: "score"});').length, 0)
})

test('ESLint checks Firebase indexes only with configured rules', () => {
  const header = 'import FirebaseDatabase from "./packages/database/src/firebase/index"; const db = new FirebaseDatabase();\n'
  const settings = { redequateDatabase: { firebaseRules: fileURLToPath(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)) } }
  assert.equal(lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "name"]});', settings).length, 0)
  const bad = lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "missing"]});', settings)
  assert.equal(bad.length, 1)
  assert.match(bad[0].message, /No Firebase \.indexOn.*nested\/missing/)
  assert.equal(lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "missing"]});').length, 0)
})

test('Local suggestions retain path roles and orderBy syntax', () => {
  const header = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  for (const [query, expected] of [
    ['db.read(["posts", "post_id"], {orderBy: "too"});', 'orderBy: "to"'],
    ['db.read(["posts", "post_id"], {orderBy: ["too"]});', 'orderBy: ["to"]'],
    ['db.read(["posts", "post_idd"]);', '["posts", "post_id"]'],
    ['db.read(["posts", {post_idd: "p1"}]);', '{post_id: "p1"}'],
    ['db.read(["postss", "post_id"]);', '["posts", "post_id"]']
  ]) {
    const source = header + query
    const messages = lint(source)
    assert.equal(messages.length, 1, query)
    const suggestion = messages[0].suggestions.find(item => item.desc === `Use ${query.includes('orderBy') ? 'to' : query.includes('postss') ? 'posts' : 'post_id'}`)
    assert.ok(suggestion, query)
    assert.ok(apply(source, suggestion).includes(expected), query)
    assert.equal(lint(apply(source, suggestion)).length, 0)
  }
})

test('Firebase suggestions use only query-node indexes and preserve array shape', () => {
  const header = 'import FirebaseDatabase from "./packages/database/src/firebase/index"; const db = new FirebaseDatabase();\n'
  const settings = { redequateDatabase: { firebaseRules: fileURLToPath(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)) } }
  const source = header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "missing"]});'
  const messages = lint(source, settings)
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0].suggestions.map(item => item.desc),
    ['Use type', 'Use to', 'Use score', 'Use nested/name'])
  for (const suggestion of messages[0].suggestions) {
    const fixed = apply(source, suggestion)
    assert.match(fixed, /orderBy: \["/)
    assert.equal(lint(fixed, settings).length, 0)
  }
})

test('suggestions stay absent for dynamic, ambiguous, and undeclared data paths', () => {
  const localHeader = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  const firebaseHeader = 'import FirebaseDatabase from "./packages/database/src/firebase/index"; const db = new FirebaseDatabase();\n'
  const settings = { redequateDatabase: { firebaseRules: fileURLToPath(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)) } }
  assert.equal(lint(localHeader + 'db.read(["posts", {post_idd: id}]);')[0].suggestions?.length ?? 0, 0)
  assert.equal(lint(localHeader + 'db.read(["posts", "wrong_id"]);')[0].suggestions?.length ?? 0, 0)
  assert.equal(lint(firebaseHeader + 'db.read("database_test/undocumented", {orderBy: "missing"});', settings).length, 0)
  assert.equal(lint(firebaseHeader + 'db.read(["database_test", "record_id"], {orderBy: field});', settings).length, 0)
  assert.equal(lint(firebaseHeader + 'db.read(["database_test", "record_id"], {orderBy: "missing"});').length, 0)
})

test('Local range suggestions respect compound index prefixes', () => {
  const header = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  const withFilter = lint(header + 'db.read(["chats", {chat_id: "c1"}, "message_id"], {orderBy: "missing", start: 1});')[0]
  assert.ok(withFilter.suggestions.some(item => item.desc === 'Use created'))
  const withoutFilter = lint(header + 'db.read(["chats", "message_id"], {orderBy: "missing", start: 1});')[0]
  assert.ok(!withoutFilter.suggestions.some(item => item.desc === 'Use created'))
})
