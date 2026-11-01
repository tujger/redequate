import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync, realpathSync, watchFile, unwatchFile } from 'node:fs'
import { dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@babel/parser'
import { resolveRules } from '../packages/database/src/firebase/rules.mjs'

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const unsafe = key => ['__proto__', 'constructor', 'prototype'].includes(key)
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'))
const baseFile = fileURLToPath(new URL('../packages/database/src/firebase/database.rules.json', import.meta.url))

/** Read only the selected static expression; never import/execute an application. */
export function extractRules(file, binding, sources = new Set()) {
  const modules = new Map()
  const active = new Set()
  const error = (path, node, message) => { throw new Error(`${path}:${node?.loc?.start.line ?? 1}:${(node?.loc?.start.column ?? 0) + 1}: ${message}`) }
  const module = path => {
    if (modules.has(path)) return modules.get(path)
    sources.add(path)
    const source = readFileSync(path, 'utf8')
    const ast = parse(source, { sourceType: 'module', plugins: ['jsx', ...(extname(path) === '.ts' ? ['typescript'] : [])] })
    const definitions = new Map(); const imports = new Map(); const exports = new Map()
    const register = node => {
      if (node?.type === 'VariableDeclaration') {
        for (const item of node.declarations) {
          if (item.id.type === 'Identifier') {
            definitions.set(item.id.name, { node: item.init, constant: node.kind === 'const' })
          }
        }
      }
    }
    for (const node of ast.program.body) {
      register(node)
      if (node.type === 'ImportDeclaration') {
        for (const spec of node.specifiers) {
          imports.set(spec.local.name, { source: node.source.value, name: spec.type === 'ImportDefaultSpecifier' ? 'default' : spec.imported?.name })
        }
      }
      if (node.type === 'ExportNamedDeclaration') {
        register(node.declaration)
        for (const item of node.declaration?.declarations ?? []) if (item.id.type === 'Identifier') exports.set(item.id.name, item.id.name)
        for (const spec of node.specifiers) exports.set(spec.exported.name, spec.local.name)
      }
      if (node.type === 'ExportDefaultDeclaration') exports.set('default', node.declaration)
    }
    const mutated = new Set()
    const rootName = node => node?.type === 'Identifier'
      ? node.name
      : node?.type === 'MemberExpression' ? rootName(node.object) : undefined
    const mark = node => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'Identifier') mutated.add(node.name)
      for (const [key, child] of Object.entries(node)) {
        if (!['loc', 'start', 'end'].includes(key)) {
          if (Array.isArray(child)) child.forEach(mark)
          else if (child && typeof child === 'object') mark(child)
        }
      }
    }
    const scan = node => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'VariableDeclarator' && node.id.type !== 'Identifier') mark(node.init)
      if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') mutated.add(rootName(node.left ?? node.argument))
      if (node.type === 'CallExpression') {
        mutated.add(rootName(node.callee?.object))
        node.arguments.forEach(mark)
      }
      if (node.type === 'NewExpression' && !['redequate/database/firebase', 'redequate/database/local'].includes(imports.get(node.callee?.name)?.source)) node.arguments.forEach(mark)
      for (const [key, child] of Object.entries(node)) {
        if (!['loc', 'start', 'end'].includes(key)) {
          if (Array.isArray(child)) child.forEach(scan)
          else if (child && typeof child === 'object') scan(child)
        }
      }
    }
    scan(ast.program)
    // Mutation through a local alias invalidates the original constant too.
    let changed = true
    while (changed) {
      changed = false
      for (const [name, definition] of definitions) {
        if (mutated.has(name)) {
          const previous = mutated.size
          mark(definition.node)
          if (mutated.size !== previous) changed = true
        }
      }
    }
    const value = { path, definitions, imports, exports, mutated }
    modules.set(path, value)
    return value
  }
  const importedFile = (context, source) => {
    if (!source.startsWith('.')) throw new Error(`${context.path}: static Rules imports must be relative`)
    const path = resolve(dirname(context.path), source)
    const candidates = [path, path + '.js', path + '.mjs', path + '.json']
    candidates.forEach(candidate => sources.add(candidate))
    return candidates.find(existsSync) ?? path
  }
  const identifier = (context, name, node) => {
    const key = `${context.path}:${name}`
    if (active.has(key)) error(context.path, node, 'cyclic Rules constant')
    active.add(key)
    try {
      if (context.mutated.has(name)) error(context.path, node, `Rules constant escapes static analysis or is mutated: ${name}`)
      const imported = context.imports.get(name)
      if (imported) {
        const path = importedFile(context, imported.source)
        if (extname(path) === '.json') {
          sources.add(path)
          if (imported.name !== 'default') error(context.path, node, 'JSON requires a default import')
          return readJSON(path)
        }
        const target = module(path)
        const exported = target.exports.get(imported.name)
        if (!exported) error(context.path, node, 'missing static export')
        return typeof exported === 'string' ? identifier(target, exported, node) : evaluate(target, exported)
      }
      const definition = context.definitions.get(name)
      if (!definition?.constant) error(context.path, node, `Rules require an immutable static const: ${name}`)
      return evaluate(context, definition.node)
    } finally { active.delete(key) }
  }
  const assign = (context, node, target, key, value) => {
    if (unsafe(key)) error(context.path, node, 'unsafe Rules key')
    if (Object.hasOwn(target, key) && !same(target[key], value)) error(context.path, node, `conflicting static property: ${key}`)
    target[key] = value
  }
  const evaluate = (context, node) => {
    if (!node) error(context.path, node, 'missing static value')
    if (['StringLiteral', 'BooleanLiteral', 'NumericLiteral'].includes(node.type)) {
      if (node.type === 'NumericLiteral' && !Number.isFinite(node.value)) error(context.path, node, 'nonfinite Rules value')
      return node.value
    }
    if (node.type === 'NullLiteral') return null
    if (node.type === 'Identifier') return identifier(context, node.name, node)
    if (node.type === 'ArrayExpression') return node.elements.map(item => evaluate(context, item))
    if (node.type === 'ObjectExpression') {
      const result = {}
      for (const item of node.properties) {
        if (item.type === 'SpreadElement') {
          const spread = evaluate(context, item.argument)
          if (!plain(spread)) error(context.path, item, 'object spread requires a static object')
          for (const [key, value] of Object.entries(spread)) assign(context, item, result, key, value)
        } else {
          if (item.type !== 'ObjectProperty' || item.computed) error(context.path, item, 'Rules require literal properties')
          const key = item.key.name ?? item.key.value
          assign(context, item, result, key, evaluate(context, item.value))
        }
      }
      return result
    }
    error(context.path, node, `dynamic Rules expression: ${node.type}`)
  }
  const context = module(resolve(file))
  const constructor = context.definitions.get(binding)?.node
  if (constructor?.type !== 'NewExpression' || constructor.callee.type !== 'Identifier') error(file, constructor, 'binding must initialize a provider with new Database(...)')
  const provider = context.imports.get(constructor.callee.name)?.source
  if (!['redequate/database/firebase', 'redequate/database/local'].includes(provider)) error(file, constructor, 'binding is not an explicit Redequate database provider')
  const options = constructor.arguments[0]
  if (!options) return {}
  if (options.type !== 'ObjectExpression') {
    const resolved = evaluate(context, options)
    if (!plain(resolved)) error(file, options, 'provider options must be an object')
    return resolved.rules ?? {}
  }
  let rules = {}; let found = false
  for (const item of options.properties) {
    if (item.type === 'SpreadElement') {
      const spread = evaluate(context, item.argument)
      if (!plain(spread)) error(file, item, 'provider options spread requires an object')
      if (Object.hasOwn(spread, 'rules')) {
        if (found) error(file, item, 'duplicate rules argument')
        rules = spread.rules; found = true
      }
    } else {
      if (item.computed || item.type !== 'ObjectProperty') error(file, item, 'provider options require literal properties')
      if ((item.key.name ?? item.key.value) === 'rules') {
        if (found) error(file, item, 'duplicate rules argument')
        rules = evaluate(context, item.value); found = true
      }
    }
  }
  return rules
}

export function resolveConfiguration(path, sources = new Set()) {
  path = resolve(path)
  sources.add(path)
  sources.add(baseFile)
  const config = readJSON(path)
  if (!plain(config) || Object.keys(config).some(key => !['providers', 'output'].includes(key)) ||
      !Array.isArray(config.providers) || !config.providers.length) throw new Error(`${path}: providers must list every application sharing this database`)
  let rules = resolveRules(readJSON(baseFile))
  const overrides = new Map()
  for (const entry of config.providers) {
    if (!plain(entry) || typeof entry.file !== 'string' || !entry.file || typeof entry.binding !== 'string' || !entry.binding ||
        Object.keys(entry).some(key => !['file', 'binding'].includes(key))) throw new Error(`${path}: invalid provider source`)
    const options = extractRules(resolve(dirname(path), entry.file), entry.binding, sources)
    for (const [key, value] of Object.entries(options.overrides ?? {})) {
      if (overrides.has(key) && !same(overrides.get(key), value)) throw new Error(`Conflicting application override at ${key}`)
      overrides.set(key, value)
    }
    rules = resolveRules(rules, options)
  }
  if (config.output !== undefined && (typeof config.output !== 'string' || !config.output)) throw new Error('Rules output must be a nonempty path')
  return { rules, sources: [...sources], output: config.output === undefined ? undefined : resolve(dirname(path), config.output) }
}

/** One loader shared by both ESLint plugins and build commands. No stale-file cache. */
export function loadRules(settings = {}) {
  const config = settings.rulesConfig ?? process.env.REDEQUATE_RULES_CONFIG
  const file = settings.firebaseRules ?? process.env.REDEQUATE_FIREBASE_RULES
  if (config && file) throw new Error('Choose rulesConfig or firebaseRules, not both')
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
  interval = 200,
  debounce = 100,
  onChange = ({ output }) => console.info(`[Rules] Generated ${output}; Emulator watches this file.`),
  onError = error => console.error(`[Rules] Generation failed; previous Rules retained: ${error.message}`)
} = {}) {
  path = resolve(path)
  const listeners = new Map()
  let timer; let closed = false; let output; let failed = false
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
      if (output !== undefined && output !== resolved.output) throw new Error('Rules output changed; restart the application')
      const changed = writeRules(resolved)
      output = resolved.output
      success = true
      if (initial || changed || failed) onChange({ output, changed })
      failed = false
    } catch (error) {
      if (initial) throw error
      failed = true
      onError(error)
    } finally {
      if (!initial || success) subscribe(success ? sources : new Set([...listeners.keys(), ...sources]))
    }
  }
  refresh(true)
  queueMicrotask(() => refresh(false))
  return {
    output,
    close() {
      closed = true
      clearTimeout(timer)
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
    if (process.argv.length !== 3) throw new Error('Usage: node tooling/firebase-rules.mjs <database-rules.config.json>')
    console.info(buildRules(process.argv[2]))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
