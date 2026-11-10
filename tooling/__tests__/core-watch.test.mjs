import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { createConnection, createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { acquireCoreLock } from '../core-watch/index.mjs'
import { startCoreWatcher, connectCoreWatcher, CORE_READY } from '../core-watch/client.mjs'
import Processes, { readProcessTable, isDescendant } from '../app/processes.mjs'

const fixture = t => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'core-watch-test-')))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'node_modules'))
  writeFileSync(join(directory, 'source.js'), 'export default 1;')
  writeFileSync(join(directory, 'other.js'), 'export default 2;')
  writeFileSync(join(directory, 'rollup.config.mjs'), 'export default () => [\'source\', \'other\'].map(name => ({input: name + \'.js\', output: {file: \'core/\' + name + \'.mjs\', format: \'es\'}}));')
  return directory
}
const wait = async predicate => {
  const deadline = Date.now() + 10000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Core watcher check timed out.')
    await delay(25)
  }
}
const launch = (t, directory) => {
  const runner = join(directory, 'run.mjs')
  writeFileSync(runner, `import {runCoreWatcher} from ${JSON.stringify(new URL('../core-watch/index.mjs', import.meta.url).href)}; try {await runCoreWatcher({root: ${JSON.stringify(directory)}})} catch (error) {console.error(error.message); process.exitCode = 1}`)
  const child = spawn(process.execPath, [runner], { cwd: directory, env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory }, stdio: ['ignore', 'pipe', 'pipe'] })
  const state = { child, output: '', exited: false }
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { state.output += chunk })
  state.completed = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => { state.exited = true; resolve(code) })
  })
  state.stop = async () => {
    if (state.exited) return
    child.kill('SIGINT')
    try { await wait(() => state.exited) } finally {
      if (!state.exited) child.kill('SIGKILL')
      await state.completed
    }
  }
  t.after(state.stop)
  return state
}

test('core watcher waits for all outputs, rebuilds, recovers from errors and releases its lock', async t => {
  const directory = fixture(t)
  const state = launch(t, directory)
  await wait(() => state.output.includes(CORE_READY) || state.exited)
  assert(!state.exited, state.output)
  for (const name of ['source', 'other']) assert(existsSync(join(directory, 'core/' + name + '.mjs')))
  assert(existsSync(join(directory, 'node_modules/.redequate-core-watch.json')))
  const second = launch(t, directory)
  assert.equal(await second.completed, 1)
  assert(second.output.includes(`already running (PID ${state.child.pid})`), second.output)
  assert.equal(state.exited, false)
  writeFileSync(join(directory, 'source.js'), 'export default ;')
  await wait(() => state.output.includes('[Core watch] Build failed:'))
  assert.equal(state.exited, false)
  writeFileSync(join(directory, 'source.js'), 'export default 42;')
  await wait(() => state.output.includes('[Core watch] Rebuilt.') && readFileSync(join(directory, 'core/source.mjs'), 'utf8').includes('42'))
  await state.stop()
  assert.equal(existsSync(join(directory, 'node_modules/.redequate-core-watch.json')), false)
  assert.throws(() => process.kill(state.child.pid, 0), { code: 'ESRCH' })
})

test('an initial failure never announces readiness and releases the lock', async t => {
  const directory = fixture(t)
  writeFileSync(join(directory, 'other.js'), 'export default ;')
  const state = launch(t, directory)
  await wait(() => state.exited)
  assert.equal(await state.completed, 1)
  assert(!state.output.includes(CORE_READY), state.output)
  assert.match(state.output, /Build failed/)
  assert.equal(existsSync(join(directory, 'node_modules/.redequate-core-watch.json')), false)
})

test('core locks reject live or unverifiable owners and recover a confirmed dead owner', async t => {
  const directory = fixture(t)
  const lock = join(directory, 'node_modules/.redequate-core-watch.json')
  const release = acquireCoreLock(directory)
  assert.throws(() => acquireCoreLock(directory), /already running/)
  release()
  writeFileSync(lock, 'incomplete')
  assert.throws(() => acquireCoreLock(directory), /Cannot verify/)
  // Reap a known child before using its PID as a stale lock owner.
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await new Promise(resolve => child.once('exit', resolve))
  writeFileSync(lock, JSON.stringify({ pid: child.pid }))
  const releaseRecovered = acquireCoreLock(directory)
  assert.equal(JSON.parse(readFileSync(lock)).pid, process.pid)
  releaseRecovered()
  assert(!existsSync(lock))
})

const connect = async (t, directory) => {
  const group = new Processes()
  const lease = await startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} })
  t.after(async () => { lease.release(); await group.stop() })
  return lease
}

test('concurrent launchers share one daemon until the last client disconnects', async t => {
  const directory = fixture(t)
  const [first, second] = await Promise.all([connect(t, directory), connect(t, directory)])
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  const owner = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(owner.mode, 'shared')
  assert.equal(owner.version, 1)
  first.release()
  await first.completed
  await delay(5500)
  assert.equal(JSON.parse(readFileSync(file)).pid, owner.pid)
  process.kill(owner.pid, 0)
  second.release()
  await second.completed
  await wait(() => !existsSync(file))
})

test('manual watcher survives clients and its shutdown disconnects every subscriber', async t => {
  const directory = fixture(t)
  const manual = launch(t, directory)
  await wait(() => manual.output.includes(CORE_READY) || manual.exited)
  assert.equal(manual.exited, false, manual.output)
  const first = await connect(t, directory)
  first.release()
  await delay(5500)
  assert.equal(manual.exited, false)
  const second = await connect(t, directory)
  const third = await connect(t, directory)
  await manual.stop()
  assert.equal((await second.completed).code, 1)
  assert.equal((await third.completed).code, 1)
})

test('new subscribers wait through rebuild errors and join only after recovery', async t => {
  const directory = fixture(t)
  const first = await connect(t, directory)
  const log = join(directory, 'node_modules/.redequate-core-watch.log')
  writeFileSync(join(directory, 'source.js'), 'export default ;')
  await wait(() => readFileSync(log, 'utf8').includes('Build failed:'))
  const group = new Processes()
  t.after(() => group.stop())
  let joined = false
  const pending = startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} }).then(lease => {
    joined = true
    t.after(() => lease.release())
    return lease
  })
  await delay(300)
  assert.equal(joined, false)
  writeFileSync(join(directory, 'source.js'), 'export default 43;')
  const second = await pending
  assert.equal(readFileSync(join(directory, 'core/source.mjs'), 'utf8').includes('43'), true)
  first.release()
  second.release()
  await wait(() => !existsSync(join(directory, 'node_modules/.redequate-core-watch.json')))
})

test('legacy, wrong-checkout and unreachable live locks are preserved', async t => {
  const directory = fixture(t)
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  const group = new Processes()
  t.after(() => group.stop())
  for (const owner of [
    { pid: process.pid, token: 'old-protocol' },
    { pid: process.pid, token: 'long-invalid-token', version: 1, root: '/another-checkout', port: 1, mode: 'manual' },
    { pid: process.pid, token: 'long-invalid-token', version: 1, root: directory, port: 1, mode: 'manual' }
  ]) {
    writeFileSync(file, JSON.stringify(owner))
    await assert.rejects(startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} }), /protocol|connect|checkout/i)
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), owner)
  }
})

test('wrong authentication is rejected without disturbing an existing subscriber', async t => {
  const directory = fixture(t)
  const first = await connect(t, directory)
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  const owner = JSON.parse(readFileSync(file, 'utf8'))
  const wrong = connectCoreWatcher({ ...owner, token: 'invalid-token' }, { onState() {} })
  await assert.rejects(wrong.ready, /disconnected|identity/)
  assert.equal((await wrong.completed).code, 1)
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).pid, owner.pid)
  first.release()
  await wait(() => !existsSync(file))
})

test('initial failure rejects subscribers and startup cancellation leaves no daemon', async t => {
  const directory = fixture(t)
  writeFileSync(join(directory, 'source.js'), 'export default ;')
  const group = new Processes()
  t.after(() => group.stop())
  await assert.rejects(startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} }), /stopped|first successful|disconnected/)
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  await wait(() => !existsSync(file))
  writeFileSync(join(directory, 'source.js'), 'export default 1;')
  writeFileSync(join(directory, 'rollup.config.mjs'), 'await new Promise(resolve => setTimeout(resolve, 500)); export default () => [{input:\'source.js\',output:{file:\'core/source.mjs\',format:\'es\'}}];')
  const pending = startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} })
  group.onSignal('SIGINT')
  await assert.rejects(pending, /interrupted/)
  await delay(6000)
  assert.equal(existsSync(file), false)
})

test('a crashed client releases its subscription without leaving a daemon behind', async t => {
  const directory = fixture(t)
  const runner = join(directory, 'client.mjs')
  writeFileSync(runner, `import {startCoreWatcher} from ${JSON.stringify(new URL('../core-watch/client.mjs', import.meta.url).href)}; await startCoreWatcher({interrupted:new Promise(()=>{})},{env:process.env},{root:${JSON.stringify(directory)},onState(){}}); console.log('subscribed');`)
  const child = spawn(process.execPath, [runner], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', chunk => { output += chunk })
  const completed = new Promise(resolve => child.once('exit', resolve))
  t.after(() => child.kill('SIGKILL'))
  await wait(() => output.includes('subscribed'))
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  child.kill('SIGKILL')
  await completed
  await wait(() => !existsSync(file))
})

test('malformed clients cannot crash a watcher and an unresponsive endpoint times out safely', async t => {
  const directory = fixture(t)
  const first = await connect(t, directory)
  const file = join(directory, 'node_modules/.redequate-core-watch.json')
  const owner = JSON.parse(readFileSync(file, 'utf8'))
  const socket = createConnection({ host: '127.0.0.1', port: owner.port })
  socket.on('connect', () => socket.write('null\n'))
  await new Promise(resolve => socket.on('close', resolve))
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).pid, owner.pid)
  first.release()
  await wait(() => !existsSync(file))

  const server = createServer(socket => socket.on('data', () => {}))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const lock = acquireCoreLock(directory, { port: server.address().port, mode: 'manual' })
  t.after(lock)
  const group = new Processes()
  t.after(() => group.stop())
  await assert.rejects(startCoreWatcher(group, { env: process.env }, { root: directory, onState() {} }), /authenticate within 2 seconds/)
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), lock.owner)
})

for (const method of ['SIGINT', 'SIGTERM', 'IDE']) {
  test(`stopping one real launcher via ${method} preserves another subscriber and rebuilds`, async t => {
    const directory = fixture(t)
    const runner = join(directory, 'launcher.mjs')
    writeFileSync(runner, `import Processes from ${JSON.stringify(new URL('../app/processes.mjs', import.meta.url).href)};
      import {startCoreWatcher} from ${JSON.stringify(new URL('../core-watch/client.mjs', import.meta.url).href)};
      const group = new Processes(); let lease;
      try { lease = await startCoreWatcher(group,{env:process.env},{root:${JSON.stringify(directory)},onState(){}}); console.log('ready'); await group.interrupted; }
      finally { await group.stop(); lease?.release(); }`)
    const child = spawn(process.execPath, [runner], { detached: true, env: { ...process.env, TMPDIR: directory, TMP: directory, TEMP: directory }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let exited = false
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const ended = new Promise(resolve => child.once('exit', code => { exited = true; resolve(code) }))
    t.after(async () => { if (!exited) child.kill('SIGKILL'); await ended })
    await wait(() => output.includes('ready') || exited)
    assert(!exited, output)
    const second = await connect(t, directory)
    const lock = join(directory, 'node_modules/.redequate-core-watch.json')
    const owner = JSON.parse(readFileSync(lock))
    const table = readProcessTable()
    assert(table.has(owner.pid))
    assert.equal(isDescendant(table, owner.pid, child.pid), false)
    if (method === 'IDE') {
      for (const [pid] of table) {
        if (pid !== child.pid && isDescendant(table, pid, child.pid)) process.kill(pid, 'SIGTERM')
      }
      child.kill('SIGTERM')
    } else process.kill(-child.pid, method)
    await ended
    await delay(5500)
    assert.equal(JSON.parse(readFileSync(lock)).pid, owner.pid)
    let disconnected = false
    second.completed.then(() => { disconnected = true })
    writeFileSync(join(directory, 'source.js'), 'export default 9876;')
    await wait(() => readFileSync(join(directory, 'core/source.mjs'), 'utf8').includes('9876'))
    assert.equal(disconnected, false)
    second.release()
    await second.completed
    await wait(() => !existsSync(lock))
    const probe = createServer()
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(owner.port, '127.0.0.1', resolve) })
    await new Promise(resolve => probe.close(resolve))
  })
}
