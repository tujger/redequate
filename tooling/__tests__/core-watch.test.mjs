import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { acquireCoreLock } from '../watch-redequate-core.mjs'
import { startCoreWatcher, CORE_READY } from '../core-lifecycle.mjs'
import Processes from '../processes.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const fixture = t => {
  const directory = mkdtempSync(join(tmpdir(), 'core-watch-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'node_modules'))
  writeFileSync(join(directory, 'source.js'), 'export default 1;')
  writeFileSync(join(directory, 'other.js'), 'export default 2;')
  writeFileSync(join(directory, 'rollup.config.mjs'), `export default () => ['source', 'other'].map(name => ({input: name + '.js', output: {file: 'core/' + name + '.mjs', format: 'es'}}));`)
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
  writeFileSync(runner, `import {runCoreWatcher} from ${JSON.stringify(new URL('../watch-redequate-core.mjs', import.meta.url).href)}; try {await runCoreWatcher({root: ${JSON.stringify(directory)}})} catch (error) {console.error(error.message); process.exitCode = 1}`)
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

test('readiness protocol waits for the marker, rejects early exit and responds to interruption', async t => {
  const before = process.listenerCount('SIGINT')
  for (const outcome of ['ready', 'exit', 'interrupt']) {
    const group = new Processes()
    let resolveExit
    let sendLine
    t.mock.method(group, 'start', (command, args, options) => {
      sendLine = options.onLine
      assert(args[0].endsWith('/watch-redequate-core.mjs'))
      assert.match(options.env.NODE_OPTIONS, /openssl-legacy-provider/)
      return { completed: new Promise(resolve => { resolveExit = resolve }) }
    })
    try {
      let settled = false
      const pending = startCoreWatcher(group, { cwd: root, env: {} })
      pending.then(() => { settled = true }, () => { settled = true })
      sendLine('[Core watch] Watching fixture')
      await delay(0)
      assert.equal(settled, false)
      if (outcome === 'ready') { sendLine(CORE_READY); await pending }
      if (outcome === 'exit') { resolveExit({ code: 1 }); await assert.rejects(pending, /before its first successful build/) }
      if (outcome === 'interrupt') { group.onSignal('SIGINT'); await assert.rejects(pending, /interrupted/) }
    } finally { await group.stop() }
  }
  assert.equal(process.listenerCount('SIGINT'), before)
})
