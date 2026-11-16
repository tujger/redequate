import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync, realpathSync, watchFile, unwatchFile } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRules } from '../packages/database/src/firebase/rules.mjs'
import { loadProjectConfig } from './app-config.mjs'

const readJSON = file => JSON.parse(readFileSync(file, 'utf8'))
const baseFile = fileURLToPath(new URL('../packages/database/src/firebase/database.rules.json', import.meta.url))

export function resolveConfiguration(path, sources = new Set()) {
  const settings = loadProjectConfig(path)
  const supplementFile = resolve(settings.root, 'database.rules.json')
  settings.sources.forEach(source => sources.add(source))
  sources.add(baseFile)
  sources.add(supplementFile) // Subscribe even when absent: creation/deletion changes composition.
  const base = readJSON(baseFile)
  let rules = resolveRules(base)
  if (existsSync(supplementFile)) {
    const supplement = readJSON(supplementFile)
    resolveRules(supplement) // Validate ordinary Firebase JSON before extracting directives.
    const additions = structuredClone(supplement.rules)
    const overrides = {}
    const extract = (node, prefix = '') => {
      for (const [key, value] of Object.entries(node)) {
        const path = prefix ? `${prefix}/${key}` : key
        if (['.read', '.write', '.validate'].includes(key)) { overrides[path] = value; delete node[key] } else if (!key.startsWith('.')) extract(value, path)
      }
    }
    extract(additions)
    rules = resolveRules(base, { additions, overrides })
  }
  return { rules, sources: [...sources], output: resolve(settings.root, '.firebase/generated/database.rules.json') }
}

/** One loader shared by both ESLint plugins and build commands. No stale-file cache. */
export function loadRules(settings = {}) {
  const automatic = resolve('redequate.config.json')
  const config = settings.projectConfig ?? process.env.REDEQUATE_CONFIG ?? (!settings.firebaseRules && !process.env.REDEQUATE_FIREBASE_RULES && existsSync(automatic) ? automatic : undefined)
  const file = settings.firebaseRules ?? process.env.REDEQUATE_FIREBASE_RULES
  if (config && file) throw new Error('Choose projectConfig or firebaseRules, not both')
  const rules = config ? resolveConfiguration(config).rules : file ? resolveRules(readJSON(resolve(file))) : resolveRules(readJSON(baseFile))
  return { rules, source: JSON.stringify(rules, null, 4), label: config ?? file ?? 'redequate/database/firebase/rules' }
}

function writeRules({ rules, output, sources }) {
  if (!output || !output.endsWith('.json')) throw new Error('Rules configuration needs a JSON output path')
  const identity = path => existsSync(path) ? realpathSync(path) : resolve(path)
  if (sources.some(input => identity(input) === identity(output))) throw new Error('Rules output must not overwrite a source')
  const content = JSON.stringify(rules, null, 4) + '\n'
  if (existsSync(output) && readFileSync(output, 'utf8') === content) return false
  mkdirSync(dirname(output), { recursive: true })
  const temporary = `${output}.${process.pid}.tmp`
  try { writeFileSync(temporary, content, { flag: 'wx' }); renameSync(temporary, output) } finally { rmSync(temporary, { force: true }) }
  return true
}

export function buildRules(path, { output } = {}) {
  const resolved = resolveConfiguration(path)
  if (output !== undefined) resolved.output = resolve(output)
  writeRules(resolved)
  return resolved.output
}

/** Owns only file subscriptions; Firebase CLI watches and applies the generated JSON. */
export function watchRules(path, {
  output: outputOverride,
  interval = 200,
  debounce = 100,
  onChange = ({ output }) => console.info(`[Rules] Generated ${output}; Emulator watches this file.`),
  onError = error => console.error(`[Rules] Generation failed; previous Rules retained: ${error.message}`)
} = {}) {
  path = resolve(path)
  const listeners = new Map()
  let timer; let closed = false; let output; let failed = false; let previousError
  const schedule = (current, previous) => {
    if (closed || ['mtimeMs', 'ctimeMs', 'size', 'ino', 'nlink'].every(key => current[key] === previous[key])) return
    clearTimeout(timer)
    timer = setTimeout(() => refresh(false), debounce)
  }
  const subscribe = sources => {
    for (const [source, listener] of listeners) {
      if (!sources.has(source)) { unwatchFile(source, listener); listeners.delete(source) }
    }
    for (const source of sources) {
      if (listeners.has(source)) continue
      const listener = (current, previous) => schedule(current, previous)
      watchFile(source, { interval }, listener)
      listeners.set(source, listener)
    }
  }
  const refresh = initial => {
    if (closed) return
    const sources = new Set()
    let success = false
    try {
      const resolved = resolveConfiguration(path, sources)
      if (outputOverride !== undefined) resolved.output = resolve(outputOverride)
      if (output !== undefined && output !== resolved.output) throw new Error('Rules output changed; restart the application')
      const changed = writeRules(resolved)
      output = resolved.output
      success = true
      if (initial || changed || failed) onChange({ output, changed })
      failed = false
      previousError = undefined
    } catch (error) {
      if (initial) throw error
      failed = true
      if (previousError !== error.message) onError(error)
      previousError = error.message
    } finally {
      if (!initial || success) subscribe(success ? sources : new Set([...listeners.keys(), ...sources]))
    }
  }
  refresh(true)
  // Optional supplements may be created/deleted before watchFile's initial stat.
  const projectPoll = setInterval(() => refresh(false), interval)
  queueMicrotask(() => refresh(false))
  return {
    output,
    close() {
      closed = true
      clearTimeout(timer)
      clearInterval(projectPoll)
      for (const [source, listener] of listeners) unwatchFile(source, listener)
      listeners.clear()
    }
  }
}

/** Build hook only: serve-mode watching belongs to the application's process lifecycle. */
export function firebaseRulesBuildPlugin(configFile) {
  return {
    name: 'redequate-firebase-rules',
    apply: 'build',
    enforce: 'pre',
    buildStart() { buildRules(configFile) }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tooling/firebase-rules.mjs <redequate.config.json>')
    console.info(buildRules(process.argv[2]))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
