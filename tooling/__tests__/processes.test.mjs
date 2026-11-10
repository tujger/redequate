import test from 'node:test'
import assert from 'node:assert/strict'
import Processes, { readProcessTable, sameProcess } from '../app/processes.mjs'

async function running(group) {
  let ready
  const started = new Promise(resolve => { ready = resolve })
  const task = group.start(process.execPath, ['-e', "process.on('SIGINT',()=>process.exit(0)); console.log('ready'); setInterval(()=>{},1000)"], {
    env: process.env, onLine(line) { if (line === 'ready') ready() }
  })
  await started
  return task
}

test('stop is idempotent and never stops another process manager', async () => {
  const first = new Processes({ graceMs: 1000 })
  const second = new Processes({ graceMs: 1000 })
  try {
    const a = await running(first)
    const b = await running(second)
    const stopped = first.stop()
    assert.equal(first.stop(), stopped)
    await stopped
    assert.equal(a.exited, true)
    assert.equal(b.exited, false)
    assert(sameProcess(b.identity, readProcessTable().get(b.child.pid)))
  } finally { await first.stop(); await second.stop() }
})

test('unrelated Hub PIDs and changed identities never receive termination signals', async t => {
  const identity = { pid: 12340, ppid: 1, pgid: 12340, started: 'original', command: 'fixture' }
  const unrelated = { pid: 12341, ppid: 1, pgid: 12341, started: 'other', command: 'other project' }
  const descendant = { pid: 12342, ppid: identity.pid, pgid: 12340, started: 'child', command: 'emulator' }
  let table = new Map([identity, unrelated, descendant].map(row => [row.pid, row]))
  const group = new Processes({ graceMs: 0, readProcesses: () => table })
  const task = { identity, child: { pid: identity.pid }, exited: false }
  group.trackEmulatorProcesses(task, [unrelated.pid, descendant.pid, process.pid])
  assert.deepEqual([...group.ownedProcesses.keys()], [descendant.pid])
  table = new Map([[descendant.pid, { ...descendant, started: 'replacement' }]])
  const kill = t.mock.method(process, 'kill', () => assert.fail('Unverified PID must not be signalled'))
  await group.stop()
  assert.equal(kill.mock.callCount(), 0)
})

test('graceful shutdown completes before verified emulator leftovers are terminated', async t => {
  const identity = { pid: 12340, ppid: 1, pgid: 12340, started: 'original', command: 'fixture' }
  const descendant = { pid: 12342, ppid: identity.pid, pgid: 12340, started: 'child', command: 'emulator' }
  const table = new Map([identity, descendant].map(row => [row.pid, row]))
  const events = []
  const group = new Processes({ graceMs: 1000, readProcesses: () => table })
  const task = {
    identity,
    child: {
      pid: identity.pid,
      kill(signal) {
        events.push(signal)
        setTimeout(() => { events.push('exported'); task.exited = true; table.delete(identity.pid); finish() }, 30)
      }
    },
    signalGroup: false,
    exited: false
  }
  let finish
  task.completed = new Promise(resolve => { finish = resolve })
  group.tasks.push(task)
  group.trackEmulatorProcesses(task, [descendant.pid])
  t.mock.method(process, 'kill', (pid, signal) => {
    assert.equal(pid, descendant.pid)
    events.push(signal)
    table.delete(pid)
  })
  await group.stop()
  assert.deepEqual(events, ['SIGINT', 'exported', 'SIGKILL'])
})

test('a verified detached emulator child is reaped after its CLI exits', async () => {
  const group = new Processes({ graceMs: 1000 })
  let report
  const reported = new Promise(resolve => { report = resolve })
  const script = `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
    child.unref(); process.on('SIGINT',()=>process.exit(0));
    console.log(child.pid); setInterval(()=>{},1000);`
  const task = group.start(process.execPath, ['-e', script], {
    signalGroup: false, env: process.env, onLine(line) { if (/^\d+$/.test(line)) report(Number(line)) }
  })
  try {
    const pid = await reported
    group.trackEmulatorProcesses(task, [pid])
    assert(group.ownedProcesses.has(pid))
    const identity = group.ownedProcesses.get(pid)
    await group.stop()
    assert.equal(task.exited, true)
    assert.equal(sameProcess(identity, readProcessTable().get(pid)), false)
  } finally { await group.stop() }
})
