import test from 'node:test'
import assert from 'node:assert/strict'
import { Linter } from 'eslint'
import { fileURLToPath } from 'node:url'
import plugin from '../eslint-database-queries.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const lint = (source, filename = `${root}src/components/example.js`) => new Linter().verify(source, [{
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: { redequate: plugin },
  rules: { 'redequate/database-queries': 'error' }
}], { filename })
const hooks = 'import {useDatabase, useBackend} from "redequate"; const db = useDatabase(); const backend = useBackend(); '
const apply = (source, fix) => source.slice(0, fix.range[0]) + fix.text + source.slice(fix.range[1])

test('context hooks check all database operations for both providers', () => {
  for (const method of ['read', 'cursor', 'create', 'update', 'delete', 'addEventListener']) {
    const source = hooks + `db.${method}(["postss", "post_id"], {});`
    const messages = lint(source)
    assert.equal(messages.length, 2, source)
    for (const provider of ['Firebase', 'Local']) {
      const message = messages.find(item => item.message.startsWith(`[${provider}]`))
      assert(message, source)
      const suggestion = message.suggestions.find(item => item.desc === `Use [${provider}] posts`)
      assert(suggestion, source)
      assert.deepEqual(lint(apply(source, suggestion.fix)), [])
    }
  }
  for (const method of ['read', 'cursor', 'create', 'update', 'delete']) {
    assert.equal(lint(hooks + `backend.request("database.${method}", ["postss", "post_id"], {});`).length, 2)
  }
  assert.deepEqual(lint(hooks + 'backend.request("notification.send", {to: "token"});'), [])
})

test('identical path errors are grouped and provider differences remain visible', () => {
  const common = lint(hooks + 'db.read(123);')
  assert.equal(common.length, 1)
  assert.match(common[0].message, /^\[Firebase, Local\]/)
  const onlyLocal = lint(hooks + 'db.read(["posts", {post_idd:id}]);')
  assert.equal(onlyLocal.length, 1)
  assert.match(onlyLocal[0].message, /^\[Local\]/)
  assert(onlyLocal[0].suggestions.some(item => item.desc === 'Use [Local] post_id'))
  const order = lint(hooks + 'db.cursor(["posts", "post_id"], {orderBy:["missing"]});')
  for (const provider of ['Firebase', 'Local']) {
    const problem = order.find(item => item.message.startsWith(`[${provider}]`))
    assert(problem)
    assert(problem.suggestions?.length)
    const source = hooks + 'db.cursor(["posts", "post_id"], {orderBy:["missing"]});'
    const fixed = apply(source, problem.suggestions[0].fix)
    assert.match(fixed, /orderBy:\[/)
    assert(!lint(fixed).some(item => item.message.startsWith(`[${provider}]`)))
  }
})

test('real controller imports, default hooks, aliases and shadowing respect scope', () => {
  for (const source of [
    'import {useDatabase as getDb} from "redequate/controllers"; const db=getDb(); const alias=db; alias.delete(["postss"]);',
    'import {useDatabase} from "../controllers"; const db=useDatabase(); db.delete(["postss"]);',
    'import useDatabase from "../controllers/AppContext/useDatabase"; const db=useDatabase(); db.delete(["postss"]);'
  ]) assert.equal(lint(source).length, 2, source)
  for (const source of [
    'import {useDatabase} from "other"; const db=useDatabase(); db.delete(["postss"]);',
    'import {useDatabase} from "redequate"; function f(useDatabase){const db=useDatabase();db.delete(["postss"]);}',
    'import {useDatabase} from "redequate"; const db=useDatabase(); function f(db){db.delete(["postss"]);}',
    'const database = unknown(); database.read(["postss"]);',
    'import {useDatabase} from "redequate"; let db=useDatabase();db=other;db.delete(["postss"]);'
  ]) assert.deepEqual(lint(source), [], source)
})

test('BackendListener subclasses expose shared backend only for their own this', () => {
  const filename = `${root}packages/backend/src/common/handlers/example.js`
  const header = 'import Listener from "../BackendListener"; '
  const source = header + 'class A extends Listener {run(){this.backend.request("database.read", ["postss"]);}}'
  assert.equal(lint(source, filename).length, 2)
  assert.equal(lint(header + 'class A extends Listener {run(){const backend=this.backend;backend.request("database.delete", ["postss"]);}}', filename).length, 2)
  assert.equal(lint(header + 'class A extends Listener {} class B extends A {run(){const f=()=>this.backend.request("database.read", ["postss"]);}}', filename).length, 2)
  for (const source of [
    header + 'class A extends Listener {run(){const f=function(){this.backend.request("database.read", ["postss"]);};}}',
    header + 'class A extends Listener {backend=custom;run(){this.backend.request("database.read", ["postss"]);}}',
    'import Listener from "other"; class A extends Listener {run(){this.backend.request("database.read", ["postss"]);}}',
    header + 'class A extends Listener {run(){this[backend].request("database.read", ["postss"]);}}'
  ]) assert.deepEqual(lint(source, filename), [])
  assert.equal(lint('import {BackendListener as Listener} from "../index"; class A extends Listener {run(){this.backend.request("database.read", ["postss"]);}}', filename).length, 2)
})

test('shared bulk updates and cursor sources retain per-provider checks', () => {
  for (const call of [
    'db.update({"postss/one": {text:"ok"}});',
    'db.update(new Map([[["postss", {post_id:"one"}], {text:"ok"}]]));',
    'db.cursor([{path:["postss", "post_id"]}], {});',
    'backend.request("database.update", {"postss/one": {text:"ok"}});'
  ]) assert.equal(lint(hooks + call).length, 2, call)
})

test('repository ESLint parses JSX and reports hook paths from a foreign working directory', async () => {
  const { spawnSync } = await import('node:child_process')
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = mkdtempSync(join(tmpdir(), 'redequate-eslint-cwd-'))
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {ESLint} from ${JSON.stringify(`${root}node_modules/eslint/lib/api.js`)};
      const eslint = new ESLint({cwd:${JSON.stringify(root)}});
      const [result] = await eslint.lintText(
        'import {useDatabase} from "redequate"; function Page(){const db=useDatabase();db.read(["postss","post_id"]);return <div/>;}',
        {filePath:${JSON.stringify(`${root}src/components/eslintCwdProbe.js`)}}
      );
      console.log(JSON.stringify(result.messages.map(({ruleId, message, fatal})=>({ruleId, message, fatal}))));
    `], { cwd: directory, encoding: 'utf8', timeout: 20000 })
    assert.equal(child.status, 0, child.stderr)
    const messages = JSON.parse(child.stdout)
    assert(!messages.some(item => item.fatal), child.stdout)
    const paths = messages.filter(item => item.ruleId === 'redequate/database-queries')
    assert.equal(paths.length, 2, child.stdout)
    assert(paths.some(item => item.message.startsWith('[Firebase]')))
    assert(paths.some(item => item.message.startsWith('[Local]')))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
