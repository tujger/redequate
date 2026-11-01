import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../../', import.meta.url))
const write = (path, value) => writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value))
const wait = async predicate => {
  const deadline = Date.now() + 10000
  while (!await predicate()) { if (Date.now() >= deadline) throw Error('Emulator hot reload timed out'); await delay(100) }
}
if (process.argv[2] === 'child') {
  const directory = process.argv[3]
  const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST
  const project = process.env.GCLOUD_PROJECT
  assert(/^127\.0\.0\.1:\d+$/.test(host) && project.startsWith('demo-'))
  const tools = await import(pathToFileURL(join(directory, 'tooling/firebase-rules.mjs')).href)
  const config = join(directory, 'rules.config.json'); const errors = []
  const watcher = tools.watchRules(config, { interval: 50, debounce: 25, onChange: () => {}, onError: error => errors.push(error) })
  const basePath = join(directory, 'packages/database/src/firebase/database.rules.json')
  const base = read => ({ rules: { records: { '.read': read, '.write': true, '.indexOn': ['old'] } } })
  const app = rules => write(join(directory, 'App.js'), `import Database from "redequate/database/firebase"; const database = new Database({rules: ${rules}});`)
  const request = async (path = 'records', method = 'GET', value, owner = false, query = {}) => {
    const url = new URL(`http://${host}/${path}.json`)
    url.searchParams.set('ns', `${project}-default-rtdb`)
    for (const [key, field] of Object.entries(query)) url.searchParams.set(key, JSON.stringify(field))
    const response = await fetch(url, { method, headers: owner ? { Authorization: 'Bearer owner' } : {}, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(3000) })
    return response.status
  }
  try {
    const hub = `http://${process.env.FIREBASE_EMULATOR_HUB}/emulators`
    const initial = await fetch(hub).then(response => response.json())
    assert.equal(await request(), 401)
    await request('records', 'PUT', { first: { old: 1, fresh: 1, imported: 1 } }, true)
    write(basePath, base(true))
    await wait(async () => await request() === 200)
    console.log('PASS live base edit applies without restart')
    assert.equal(await request('records', 'GET', undefined, false, { orderBy: 'fresh' }), 400)
    app('{additions: {records: {".indexOn": ["fresh"]}}}')
    await wait(async () => await request('records', 'GET', undefined, false, { orderBy: 'fresh' }) === 200)
    console.log('PASS inline additions update index')
    write(join(directory, 'options.json'), { additions: { records: { '.indexOn': ['imported'] } }, overrides: { 'records/.read': false } })
    write(join(directory, 'App.js'), 'import Database from "redequate/database/firebase"; import options from "./options.json"; const database = new Database({rules: options});')
    await wait(async () => await request() === 401)
    const artifact = readFileSync(join(directory, 'rules.json'), 'utf8')
    write(join(directory, 'options.json'), '{')
    await wait(() => errors.length > 0)
    assert.equal(readFileSync(join(directory, 'rules.json'), 'utf8'), artifact)
    assert.equal(await request(), 401)
    write(join(directory, 'options.json'), { additions: { records: { '.indexOn': ['imported'] } }, overrides: { 'records/.read': true } })
    await wait(async () => await request('records', 'GET', undefined, false, { orderBy: 'imported' }) === 200)
    console.log('PASS imported options, failed generation and recovery')
    app('{}')
    await wait(() => JSON.parse(readFileSync(join(directory, 'rules.json'))).rules.records['.indexOn'].length === 1)
    write(basePath, base('auth..uid'))
    await wait(() => readFileSync(join(directory, 'cli.log'), 'utf8').includes('Failed to update rules'))
    assert.equal(await request(), 200)
    write(basePath, base(false))
    await wait(async () => await request() === 401)
    console.log('PASS Firebase rejects invalid expression and recovers on correction')
    app('{additions: {records: {$id: {".validate": "newData.isString()"}}}}')
    await wait(async () => await request('records/check', 'PUT', 7) === 401)
    assert.equal(await request('records/check', 'PUT', 'valid'), 200)
    const final = await fetch(hub).then(response => response.json())
    assert.equal(final.database.pid, initial.database.pid)
    console.log('PASS validation hot reload; Database Emulator PID unchanged')
  } finally { watcher.close() }
} else {
  const directory = mkdtempSync(join(tmpdir(), 'rules-live-'))
  const runtime = join(directory, 'runtime'); mkdirSync(runtime)
  const configDir = join(directory, 'config'); mkdirSync(configDir)
  const ports = []
  for (let i = 0; i < 3; i++) {
    const port = await new Promise((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)) }) })
    assert(port >= 10000 && !ports.includes(port)); ports.push(port)
  }
  try {
    mkdirSync(join(directory, 'tooling')); mkdirSync(join(directory, 'packages/database/src/firebase'), { recursive: true })
    for (const path of ['tooling/firebase-rules.mjs', 'packages/database/src/firebase/rules.mjs']) copyFileSync(join(root, path), join(directory, path))
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
    write(join(directory, 'packages/database/src/firebase/database.rules.json'), { rules: { records: { '.read': false, '.write': true, '.indexOn': ['old'] } } })
    write(join(directory, 'App.js'), 'import Database from "redequate/database/firebase"; const database = new Database({});')
    write(join(directory, 'rules.config.json'), { providers: [{ file: 'App.js', binding: 'database' }], output: 'rules.json' })
    const tools = await import(pathToFileURL(join(directory, 'tooling/firebase-rules.mjs')).href)
    tools.buildRules(join(directory, 'rules.config.json'))
    write(join(directory, 'firebase.json'), { database: { rules: 'rules.json' }, emulators: { database: { host: '127.0.0.1', port: ports[0] }, hub: { host: '127.0.0.1', port: ports[1] }, logging: { host: '127.0.0.1', port: ports[2] }, ui: { enabled: false }, singleProjectMode: true } })
    const quote = value => `'${value.replaceAll("'", "'\\''")}'`
    const { openSync, closeSync } = await import('node:fs')
    const log = openSync(join(directory, 'cli.log'), 'w')
    const result = spawnSync(process.execPath, [join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--config', join(directory, 'firebase.json'), '--project', `demo-rules-live-${process.pid}`, '--only', 'database', [process.execPath, fileURLToPath(import.meta.url), 'child', directory].map(quote).join(' ')], {
      cwd: directory, env: { ...process.env, TMPDIR: runtime, TMP: runtime, TEMP: runtime, XDG_CONFIG_HOME: configDir, CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' }, stdio: ['ignore', log, log], timeout: 90000, killSignal: 'SIGINT'
    })
    closeSync(log)
    console.log(readFileSync(join(directory, 'cli.log'), 'utf8'))
    assert.equal(result.status, 0, result.error?.message)
  } finally {
    for (const port of ports) await new Promise((resolve, reject) => { const server = createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(resolve)) })
    rmSync(directory, { recursive: true, force: true })
    console.log('PASS Emulator ports released and temporary files removed')
  }
}
