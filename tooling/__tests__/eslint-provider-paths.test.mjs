import test from 'node:test'
import assert from 'node:assert/strict'
import { Linter, ESLint } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { fileURLToPath } from 'node:url'
import queries, { createDatabaseQueries } from '../eslint-database-queries.mjs'
import localStores, { storesJsonParser, createLocalStoresRule } from '../eslint-local-stores.mjs'
import { loadBaseRules } from '../database-schema.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const lint = (code, typescript = false) => new Linter().verify(code, [{
  files: ['**/*.{js,ts}'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', ...(typescript ? { parser: tsParser } : {}) },
  plugins: { redequate: queries },
  rules: { 'redequate/database-queries': 'error' }
}], { filename: typescript ? 'example.ts' : 'example.js' })
const local = 'import DB from "redequate/database/local"; const db = new DB(); '
const firebase = 'import DB from "redequate/database/firebase"; const db = new DB({}); '
const apply = (source, suggestion) => source.slice(0, suggestion.fix.range[0]) + suggestion.fix.text + source.slice(suggestion.fix.range[1])

test('all direct operations report errors and retain safe root corrections', () => {
  for (const header of [local, firebase]) {
    for (const call of [
      'db.read(["postss", "post_id"]);', 'db.cursor(["postss", "post_id"]);',
      'db.create(["postss", "post_id"], {});', 'db.update(["postss", {post_id:"p"}], {});',
      'db.delete(["postss", {post_id:"p"}]);', 'db.addEventListener(["postss", "post_id"], {});'
    ]) {
      const source = header + call
      const messages = lint(source)
      assert.equal(messages.length, 1, source)
      assert.equal(messages[0].severity, 2)
      const suggestion = messages[0].suggestions.find(item => item.desc === 'Use posts')
      assert(suggestion, source)
      assert.deepEqual(lint(apply(source, suggestion)), [], source)
    }
  }
})

test('backend requests use their concrete Local/Firebase provider, not the command argument as path', () => {
  for (const imported of [
    'import Backend from "redequate/backend/local";',
    'import Backend from "redequate/backend/firebase-client";',
    'import {FirebaseServerBackend as Backend} from "redequate-server/backend/firebase-server";'
  ]) {
    for (const command of ['read', 'cursor', 'create', 'update', 'delete']) {
      const source = imported + `const backend = new Backend({}); backend.request("database.${command}", ["postss", "post_id"], {});`
      const messages = lint(source)
      assert.equal(messages.length, 1, source)
      assert.match(messages[0].message, /postss/)
      assert(messages[0].suggestions.some(item => item.desc === 'Use posts'))
    }
    assert.deepEqual(lint(imported + 'const backend = new Backend({}); backend.request("notification.send", ["invalid"]);'), [])
  }
})

test('aliases are scoped and reassigned or unknown providers are never guessed', () => {
  assert.equal(lint(local + 'const alias = db; alias.delete(["postss"]);').length, 1)
  assert.deepEqual(lint(local + 'function f(db) {db.delete(["postss"]);}'), [])
  assert.deepEqual(lint('const db = something; db.read(["postss"]);'), [])
  assert.deepEqual(lint('import DB from "redequate/database/local"; let db = new DB(); db = other; db.read(["postss"]);'), [])
  assert.deepEqual(lint('import Generic from "redequate/database"; const db = new Generic(); db.read(["postss"]);'), [])
})

test('simple explicit JSDoc and TypeScript annotations enable checking without generated types', () => {
  for (const source of [
    '/** @param {import("redequate/database/local").default} db */ function f(db) {db.delete(["postss"]);}',
    'import Local from "redequate/database/local"; /** @param {Local} db */ function f(db) {db.read(["postss"]);}',
    'import Local from "redequate/database/local"; /** @type {Local} */ const db = unknown(); db.read(["postss"]);',
    '/** @param {import("redequate/backend/firebase-client").default} backend */ function f(backend) {backend.request("database.read", ["postss"]);}'
  ]) assert.equal(lint(source).length, 1, source)
  assert.equal(lint('import Local from "redequate/database/local"; function f(db: Local) {db.delete(["postss"]);}', true).length, 1)
  assert.equal(lint('function f(db: import("redequate/database/local").default) {db.delete(["postss"]);}', true).length, 1)
})

test('this follows concrete inheritance and annotated fields but not dynamic function callbacks', () => {
  assert.equal(lint('import DB from "redequate/database/local"; class D extends DB {f(){this.read(["postss"]); const f = () => this.read(["postss"]); const g = function(){this.read(["postss"]);};}}').length, 2)
  assert.equal(lint('class D {/** @type {import("redequate/backend/firebase-client").default} */ backend; f(){this.backend.request("database.read", ["postss"]);}}').length, 1)
})

test('known invalid parts are checked beside dynamic values and options', () => {
  const bad = lint(local + 'db.read(["posts", {post_idd:id}], {onError: handler});')
  assert.equal(bad.length, 1)
  assert.equal(bad[0].suggestions[0].desc, 'Use post_id')
  assert.equal(lint(local + 'db.read(["posts", unknownPart, ""], options);').length, 1)
  assert.deepEqual(lint(local + 'db.read(["posts", unknownPart, "post_id"], {orderBy:"uid"});'), [])
  assert.equal(lint(local + 'db.read(["posts"], {...options, orderBy:"missing"});').length, 1)
  assert.deepEqual(lint(local + 'db.read(dynamicPath, {orderBy:"missing"});'), [])
  assert.equal(lint(local + 'const path=["postss","post_id"]; db.read(path);').length, 1)
})

test('mutable const paths and escaped aliases are not treated as frozen literals', () => {
  for (const source of [
    'const path=["postss"]; path[0]="posts"; db.read(path);',
    'const path=["postss"]; const alias=path; alias[0]="posts"; db.read(path);',
    'const path=["postss"]; path.splice(0,1,"posts"); db.read(path);',
    'const path=["postss"]; change(path); db.read(path);'
  ]) assert.deepEqual(lint(local + source), [], source)
  assert.equal(lint(local + 'const path=["postss"]; db.read(path);').length, 1)
  assert.equal(lint(local + 'const field="wrong_id"; db.read(["posts",field]);').length, 1)
})

test('bulk update and cursor sources are inspected without interpreting record values as paths', () => {
  assert.equal(lint(local + 'db.update({"postss/p": {value:"posts"}, "posts/p": {value:"postss"}});').length, 1)
  assert.equal(lint(local + 'db.update(new Map([[["postss", {post_id:"p"}], {value:"x"}]]));').length, 1)
  assert.deepEqual(lint(local + 'class Map {} db.update(new Map([[["postss"],{}]]));'), [])
  assert.equal(lint(local + 'db.cursor([{path:["posts"],orderBy:"missing"}, otherCursor]);').length, 1)
  assert.deepEqual(lint(local + 'db.create(["posts","post_id"], {path:["postss"]});'), [])
})

test('create and listener contracts remain operation-specific; orderBy arrays mean one field path', () => {
  assert.equal(lint(firebase + 'db.create("posts", {});').length, 1)
  assert.deepEqual(lint(firebase + 'db.addEventListener([], {});'), [])
  for (const header of [local, firebase]) assert.equal(lint(header + 'db.addEventListener(["posts","post_id"], {orderBy:["uid","to"]});').length, 1)
  assert.deepEqual(lint(firebase + 'db.read("posts/p/arbitraryDataField");'), [])
  assert.deepEqual(lint('import DB from "redequate/database/local"; const db=new DB({stores:custom});db.read(["custom"],{orderBy:"anything"});'), [])
  assert.equal(lint('import DB from "redequate/database/local";const db=new DB({stores:custom});db.read(["custom", ""]);').length, 1)
})

test('base-only default ignores application settings; schema failures are explicit diagnostics', () => {
  const rules = new Linter().verify(firebase + 'db.read(["posts"],{orderBy:"created"});', [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, plugins: { redequate: queries }, rules: { 'redequate/database-queries': 'error' }, settings: { redequateDatabase: { rulesConfig: '/missing/application.json', firebaseRules: '/missing/rules.json' } } }])
  assert.match(rules[0].message, /No Firebase .indexOn for created/)
  const broken = { rules: { 'database-queries': createDatabaseQueries(() => { throw Error('bad base') }) } }
  const diagnostics = new Linter().verify('const x = 1;', [{ plugins: { redequate: broken }, rules: { 'redequate/database-queries': 'error' } }])
  assert.match(diagnostics[0].message, /Cannot resolve database schema: bad base/)
  const localBroken = { rules: { 'local-stores': createLocalStoresRule(() => { throw Error('bad base') }) } }
  assert.match(new Linter().verify('[]', [{ files: ['**/*.json'], languageOptions: { parser: storesJsonParser }, plugins: { redequate: localBroken }, rules: { 'redequate/local-stores': 'error' } }], { filename: 'stores.json' })[0].message, /bad base/)
  assert(loadBaseRules().label.endsWith('/packages/database/src/firebase/database.rules.json'))
})

test('repository ESLint enables both rules as errors, including stores.json', async () => {
  const eslint = new ESLint({ cwd: root })
  assert.equal((await eslint.calculateConfigForFile('packages/database/src/local/stores.json')).rules['redequate/local-stores'][0], 2)
  assert.equal((await eslint.calculateConfigForFile('src/example.js')).rules['redequate/database-queries'][0], 2)
  assert(localStores.rules['local-stores'])
})
