import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { rollup } from 'rollup'
import serverBuild from '../../packages/server/build.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const fixture = t => {
  const directory = mkdtempSync(join(tmpdir(), 'redequate-server-build-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  return directory
}

test('server build transforms transitive Local TypeScript and emits loadable ESM/CJS common exports', { timeout: 90000 }, async t => {
  const directory = fixture(t)
  const output = join(directory, 'dist')
  const result = spawnSync('npm', ['run', 'build server', '--', '--configOutput', output], {
    cwd: root,
    env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory },
    encoding: 'utf8', timeout: 60000,
  })
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout)
  for (const entry of ['common/index', 'database/index', 'backend/common', 'backend/firebase-server/index']) {
    for (const extension of ['mjs', 'cjs']) assert(existsSync(join(output, `${entry}.${extension}`)), `${entry}.${extension}`)
  }
  const esm = await import(pathToFileURL(join(output, 'common/index.mjs')).href)
  const cjs = require(join(output, 'common/index.cjs'))
  assert.equal(esm.UserRole.ADMIN, 'admin')
  assert.equal(cjs.UserRole.ADMIN, esm.UserRole.ADMIN)
  assert.equal(typeof esm.UserData, 'function')
  assert.equal(typeof cjs.UserData, 'function')
})

test('server boundary still rejects an unlisted Local module', async t => {
  const directory = fixture(t)
  const [config] = serverBuild({ configOutput: join(directory, 'dist') })
  const forbidden = fileURLToPath(new URL('../../packages/backend/src/local/unlisted-server-fixture.js', import.meta.url))
  config.input = forbidden
  config.plugins.unshift({
    name: 'unlisted-local-module-fixture',
    resolveId(id) { if (id === forbidden) return id },
    load(id) { if (id === forbidden) return 'export const outside = true;' },
  })
  await assert.rejects(async () => {
    const bundle = await rollup(config)
    try { await bundle.generate(config.output[0]) }
    finally { await bundle.close() }
  }, /Server package cannot include modules outside its source boundary: .*unlisted-server-fixture\.js/)
})
