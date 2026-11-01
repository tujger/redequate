import test from 'node:test'
import assert from 'node:assert/strict'
import { Linter, ESLint } from 'eslint'
import { fileURLToPath } from 'node:url'
import queries from '../eslint-database-queries.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const lint = (source, settings = {}) => new Linter().verify(source, [{
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: { redequate: queries },
  rules: { 'redequate/database-queries': 'error' },
  settings
}], { filename: `${root}example.js` })
const apply = (source, suggestion) => source.slice(0, suggestion.fix.range[0]) + suggestion.fix.text + source.slice(suggestion.fix.range[1])

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

test('ESLint checks Firebase indexes using configured Rules', () => {
  const header = 'import FirebaseDatabase from "./packages/database/src/firebase/index"; const db = new FirebaseDatabase();\n'
  const settings = { redequateDatabase: { firebaseRules: fileURLToPath(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)) } }
  assert.equal(lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "name"]});', settings).length, 0)
  const bad = lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "missing"]});', settings)
  assert.equal(bad.length, 1)
  assert.match(bad[0].message, /No Firebase \.indexOn.*nested\/missing/)
  assert.deepEqual(lint(header + 'db.read(["database_test", "record_id"], {orderBy: ["nested", "missing"]});'), [])
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

test('suggestions require provable fixes and do not invent undeclared data fields', () => {
  const localHeader = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  const firebaseHeader = 'import FirebaseDatabase from "./packages/database/src/firebase/index"; const db = new FirebaseDatabase();\n'
  const settings = { redequateDatabase: { firebaseRules: fileURLToPath(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)) } }
  const dynamic = lint(localHeader + 'db.read(["posts", {post_idd: id}]);')
  assert.match(dynamic[0].message, /No Local index/)
  assert.equal(dynamic[0].suggestions?.length ?? 0, 0)
  assert.equal(lint(localHeader + 'db.read(["posts", "wrong_id"]);')[0].suggestions?.length ?? 0, 0)
  assert.equal(lint(firebaseHeader + 'db.read("database_test/undocumented", {orderBy: "missing"});', settings).length, 0)
  assert.equal(lint(firebaseHeader + 'db.read(["database_test", "record_id"], {orderBy: field});', settings).length, 0)
  assert.deepEqual(lint(firebaseHeader + 'db.read(["database_test", "record_id"], {orderBy: "missing"});'), [])
})

test('Local range suggestions respect compound index prefixes', () => {
  const header = 'import LocalDatabase from "./packages/database/src/local/index"; const db = new LocalDatabase();\n'
  const withFilter = lint(header + 'db.read(["chats", {chat_id: "c1"}, "message_id"], {orderBy: "missing", start: 1});')[0]
  assert.ok(withFilter.suggestions.some(item => item.desc === 'Use created'))
  const withoutFilter = lint(header + 'db.read(["chats", "message_id"], {orderBy: "missing", start: 1});')[0]
  assert.ok(!withoutFilter.suggestions.some(item => item.desc === 'Use created'))
})

test('read and cursor check explicit provider aliases with the same safe corrections', () => {
  for (const method of ['read', 'cursor']) {
    for (const path of ['redequate/database/local', './packages/database/src/local/index']) {
      const source = `import DB from "${path}"; const original = new DB(); const alias = original; alias.${method}(["postss", "post_id"]);`
      const messages = lint(source)
      assert.equal(messages.length, 1, source)
      assert.match(messages[0].message, /Unknown Local store postss/)
      const suggestion = messages[0].suggestions.find(item => item.desc === 'Use posts')
      assert(suggestion, source)
      assert.deepEqual(lint(apply(source, suggestion)), [])
    }
    assert.deepEqual(lint(`import DB from "redequate/database/local"; const db=new DB(); db.${method}(["posts", "post_id"], {orderBy:field});`), [])
  }
})

test('query configuration failures are reported and repository checks retain warning severity', async () => {
  const source = 'import DB from "redequate/database/firebase"; const db=new DB(); db.read(["posts"], {orderBy:"created"});'
  assert.match(lint(source)[0].message, /No Firebase \.indexOn for created/)
  const messages = lint(source, { redequateDatabase: { firebaseRules: '/missing/database.rules.json' } })
  assert.equal(messages.length, 1)
  assert.match(messages[0].message, /Cannot resolve Firebase Rules/)
  const conflicting = lint(source, { redequateDatabase: { rulesConfig: 'one', firebaseRules: 'two' } })
  assert.match(conflicting[0].message, /Choose rulesConfig or firebaseRules, not both/)
  const eslint = new ESLint({ cwd: root })
  assert.equal((await eslint.calculateConfigForFile('packages/database/src/local/stores.json')).rules['redequate/local-stores'][0], 1)
  assert.equal((await eslint.calculateConfigForFile('src/example.js')).rules['redequate/database-queries'][0], 1)
})
