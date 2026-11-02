import { stripVTControlCharacters } from 'node:util'

// Firebase CLI 15 emits these lifecycle messages after startAll and before cleanup.
export function observeEmulatorLine(line, task) {
  const text = stripVTControlCharacters(line)
  if (text.includes('All emulators ready!')) task.ready = true
  if (text.includes('Shutting down emulators.') || text.includes('Starting a clean shutdown.')) task.shutdownStarted = true
}

export function emulatorReady(task) {
  return task.ready === true && !task.shutdownStarted && !task.exited
}
