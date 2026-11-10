import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { analyzePath, UNKNOWN } from '../eslint/schema-paths.mjs'

const stores = JSON.parse(readFileSync(new URL('../../packages/database/src/local/stores.json', import.meta.url)))
const rules = JSON.parse(readFileSync(new URL('../../src/__tests__/fixtures/database.rules.json', import.meta.url)))
const local = (path, options) => analyzePath({ path, options, provider: 'local', stores })
const firebase = (path, options) => analyzePath({ path, options, provider: 'firebase', rules })
const codes = diagnostics => diagnostics.map(item => item.code)
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
