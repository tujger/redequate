import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Linter } from 'eslint'
import plugin, { storesJsonParser } from '../eslint/local-stores.mjs'

const lint = (stores, rulesPath) => new Linter().verify(JSON.stringify(stores, null, 2), [{
  files: ['**/*.json'],
  languageOptions: { parser: storesJsonParser },
  plugins: { redequate: plugin },
  rules: { 'redequate/local-stores': 'warn' },
  settings: rulesPath ? { redequateDatabase: { firebaseRules: rulesPath } } : {}
}], { filename: 'stores.json' })

const store = (name, fields, options = {}) => ({
  store: name,
  storeConfig: { keyPath: '_id', autoIncrement: true },
  storeSchema: fields.map((keypath, i) => ({ name: `index_${i}`, keypath, options }))
})

const withRules = (rules, fn) => {
  const directory = mkdtempSync(join(tmpdir(), 'redequate-rules-'))
  const path = join(directory, 'database.rules.json')
  try { writeFileSync(path, JSON.stringify({ rules })); return fn(path) } finally { rmSync(directory, { recursive: true }) }
}

test('accepts direct and wildcard compound indexes', () => withRules({
  posts: { '.indexOn': ['uid', 'to'] },
  alerts: { $user_id: { '.indexOn': ['timestamp'] } }
}, path => {
  assert.deepEqual(lint([store('posts', ['uid', 'to']), store('alerts', [['user_id', 'timestamp']])], path), [])
}))

test('reports a real missing index at the affected store', () => withRules({
  posts: { '.indexOn': ['uid', 'to'] }
}, path => {
  const messages = lint([store('posts', ['uid'])], path)
  assert.equal(messages.length, 1)
  assert.match(messages[0].message, /store posts is missing index for to/)
  assert.equal(messages[0].line, 8)
}))

test('maps nested Firebase fields to one Local nested keypath', () => withRules({
  posts: { '.indexOn': ['nested/name'] }
}, path => {
  assert.deepEqual(lint([store('posts', ['nested.name'])], path), [])
  assert.match(lint([store('posts', [['nested', 'name']])], path)[0].message, /nested.name/)
}))

test('defaults to base Rules and reports unreadable explicit configuration', () => {
  assert.match(lint([store('posts', ['uid'])])[0].message, /missing index for to/)
  assert.match(lint([store('posts', ['uid'])], '/nonexistent/database.rules.json')[0].message, /Cannot read Firebase rules/)
})

test('does not invent schema constraints from rules', () => withRules({
  posts: { '.indexOn': '.value' }
}, path => {
  assert.deepEqual(lint([store('posts', ['local_only'], { unique: true, multiEntry: true })], path), [])
  assert.deepEqual(lint([store('local_only', ['local_only'])], path), [])
}))

test('reports extra and incorrect mappings at the index keypath', () => withRules({
  posts: { '.indexOn': ['uid', 'to'] }
}, path => {
  const messages = lint([{
    store: 'posts',
    storeConfig: { keyPath: '_id', autoIncrement: true },
    storeSchema: [{ name: 'uid', keypath: 'wrong' }, { name: 'to', keypath: 'to' },
      { name: 'aux', keypath: 'other' }, { name: 'identity', keypath: 'id', options: { unique: true } }]
  }], path)
  assert.equal(messages.length, 2)
  assert.match(messages[0].message, /index uid has keypath "wrong".*requires uid/)
  assert.match(messages[1].message, /index aux.*no matching Firebase/)
  assert.equal(messages[0].line, 11)
  assert.equal(messages[1].line, 19)
}))

test('allows prefix derivation and does not flatten literal child rules', () => withRules({
  alerts: { $user_id: { '.indexOn': 'timestamp' } },
  posts: { fixed: { '.indexOn': 'score' } }
}, path => {
  assert.deepEqual(lint([store('alerts', ['user_id', ['user_id', 'timestamp']])], path), [])
  const messages = lint([store('posts', ['score'])], path)
  assert.equal(messages.length, 1)
  assert.match(messages[0].message, /Nested literal rule path needs an explicit Local mapping/)
}))

test('reports original composite indexes still missing from Rules', () => withRules({
  alerts: { '.indexOn': ['user_id', 'timestamp'] },
  chats: { '.indexOn': ['chat_id', 'created'] }
}, path => {
  const messages = lint([
    {
      store: 'alerts',
      storeSchema: [
        { name: 'user_id', keypath: 'user_id' },
        { name: 'timestamp', keypath: 'timestamp' },
        { name: 'user_id_timestamp', keypath: ['user_id', 'timestamp'] }
      ]
    },
    {
      store: 'chats',
      storeSchema: [
        { name: 'chat_id', keypath: 'chat_id' },
        { name: 'created', keypath: 'created' },
        { name: 'chat_id_created', keypath: ['chat_id', 'created'] }
      ]
    }
  ], path)
  assert.equal(messages.length, 2)
  assert.match(messages.find(message => /user_id_timestamp/.test(message.message)).message, /alerts.*user_id \+ timestamp.*no matching Firebase/)
  assert.match(messages.find(message => /chat_id_created/.test(message.message)).message, /chats.*chat_id \+ created.*no matching Firebase/)
}))

test('reports original composite indexes when Rules have no index declarations', () => withRules({
  alerts: { '.read': true },
  chats: { '.read': true }
}, path => {
  const messages = lint([
    store('alerts', [['user_id', 'timestamp']]),
    store('chats', [['chat_id', 'created']])
  ], path)
  assert.equal(messages.length, 2)
  assert.match(messages[0].message, /alerts.*user_id \+ timestamp.*no matching Firebase/)
  assert.match(messages[1].message, /chats.*chat_id \+ created.*no matching Firebase/)
}))

test('does not derive an empty compound keypath from a declared index', () => withRules({
  alerts: { $user_id: { '.indexOn': 'timestamp' } }
}, path => {
  const messages = lint([store('alerts', [[]])], path)
  assert.equal(messages.length, 2)
  assert.match(messages[1].message, /no matching Firebase/)
}))

test('does not treat an empty declaration as authoritative', () => withRules({
  posts: { '.indexOn': [] }
}, path => {
  const messages = lint([store('posts', ['local'])], path)
  assert.equal(messages.length, 1)
  assert.match(messages[0].message, /expected nonempty Firebase index paths/)
}))

test('shows the actual rules source location for missing indexes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'redequate-rules-'))
  const path = join(directory, 'database.rules.json')
  try {
    writeFileSync(path, '{\n  "rules": {\n    "posts": {".indexOn": "to"}\n  }\n}')
    const messages = lint([store('posts', [])], path)
    assert.equal(messages.length, 1)
    assert.match(messages[0].message, /posts\/\.indexOn \(3:26\)/)
  } finally { rmSync(directory, { recursive: true }) }
})

test('allows simple indexes for wildcard path keys without requiring them', () => withRules({
  mutualrequests: { $mutual_type: { $mutual_id: {} } }
}, path => {
  assert.deepEqual(lint([store('mutualrequests', ['mutual_type', 'mutual_id', ['mutual_id']])], path), [])
  assert.deepEqual(lint([store('mutualrequests', [])], path), [])
}))

test('wildcard permissions stay within their store', () => withRules({
  mutualrequests: { $mutual_type: { $mutual_id: {} } },
  posts: { '.read': true }
}, path => {
  const messages = lint([
    store('mutualrequests', ['unknown', ['mutual_type', 'mutual_id']]),
    store('posts', ['mutual_id'])
  ], path)
  assert.equal(messages.length, 2)
  for (const message of messages) assert.equal(message.messageId, 'extra')
}))

test('does not map wildcard keys below literal branches', () => withRules({
  mutualrequests: { $mutual_type: { fixed: { $mutual_id: {} } } }
}, path => {
  const messages = lint([store('mutualrequests', ['mutual_type', 'mutual_id'])], path)
  assert.equal(messages.length, 1)
  assert.match(messages[0].message, /mutual_id.*no matching Firebase/)
}))

test('allows full wildcard paths and their prefixes without requiring indexes', () => withRules({
  mutualstamps: { $mutual_type: { $user_id: { $mutual_id: {} } } }
}, path => {
  assert.deepEqual(lint([store('mutualstamps', [
    ['mutual_type'],
    ['mutual_type', 'user_id'],
    ['mutual_type', 'user_id', 'mutual_id']
  ])], path), [])
  assert.deepEqual(lint([store('mutualstamps', [])], path), [])
}))

test('rejects reordered, skipped, and non-prefix wildcard combinations', () => withRules({
  mutualstamps: { $mutual_type: { $user_id: { $mutual_id: {} } } }
}, path => {
  const messages = lint([store('mutualstamps', [
    ['user_id', 'mutual_type'],
    ['mutual_type', 'mutual_id'],
    ['user_id', 'mutual_id'],
    []
  ])], path)
  assert.equal(messages.length, 4)
  for (const message of messages) assert.equal(message.messageId, 'extra')
}))

test('does not combine wildcard fields across branches or literal segments', () => withRules({
  records: {
    $type: { $user: { fixed: { $child: {} } } },
    fixed: { $item: {} }
  }
}, path => {
  const messages = lint([store('records', [
    ['type', 'item'],
    ['type', 'user', 'child'],
    ['type', 'user', 'fixed', 'child']
  ])], path)
  assert.equal(messages.length, 3)
  for (const message of messages) assert.equal(message.messageId, 'extra')
}))
