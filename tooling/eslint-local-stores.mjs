import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadRules } from './firebase-rules.mjs'
import * as espree from 'espree'

// Espree supplies ESLint locations; JSON.parse remains the authority for JSON syntax.
export const storesJsonParser = {
  parseForESLint(source) {
    JSON.parse(source)
    return { ast: espree.parse(source, { ecmaVersion: 'latest', sourceType: 'script', loc: true, range: true, tokens: true, comment: true }) }
  }
}

const get = (node, name) => node?.properties?.find(property => property.key?.value === name)?.value
const literal = node => node?.type === 'Literal' ? node.value : undefined
const key = value => JSON.stringify(typeof value === 'string' ? [value] : value)
const fieldPath = field => field.split('/').join('.')
// A declared Firebase index also permits its nonempty, proper Local prefixes.
const isDeclaredPrefix = (parts, originals) => parts.length > 0 && originals.some(entry =>
  parts.length < entry.path.length && parts.every((part, i) => part === entry.path[i]))
const ruleIndexes = node => Object.hasOwn(node, '.indexOn')
  ? Array.isArray(node['.indexOn']) ? node['.indexOn'] : [node['.indexOn']]
  : null

export function compareStoresWithRules(stores, rules) {
  const issues = []
  const roots = rules?.rules ?? rules
  if (!roots || typeof roots !== 'object' || Array.isArray(roots)) return issues
  for (const store of stores) {
    const root = roots[store.store]
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue
    const expected = new Map()
    const wildcardFields = new Set()
    const wildcardPaths = new Set()
    let uncertain = false
    const visit = (node, segments = []) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return
      // Wildcard keys are flattened into Local fields, even without .indexOn.
      // Literal branches need an explicit mapping to the root store.
      if (segments.length && segments.every(segment => segment.startsWith('$') && segment.length > 1)) {
        wildcardFields.add(segments.at(-1).slice(1))
        wildcardPaths.add(key(segments.map(segment => segment.slice(1))))
      }
      const indexes = ruleIndexes(node)
      if (indexes) {
        if (!indexes.length) {
          issues.push({ kind: 'uncertain', store: store.store, rulesPath: [store.store, ...segments, '.indexOn'].join('/'), detail: 'An empty .indexOn array is not a documented Firebase index declaration.' })
          uncertain = true
        } else {
          for (const field of indexes) {
            const rulesPath = [store.store, ...segments, '.indexOn'].join('/')
            if (field === '.value') continue // Firebase value indexes have no general IndexedDB field mapping.
            if (typeof field !== 'string' || !field || field.startsWith('/') || field.endsWith('/') || field.includes('//')) {
              issues.push({ kind: 'uncertain', store: store.store, rulesPath, detail: `Cannot map Firebase index ${JSON.stringify(field)} to a Local field.` })
              uncertain = true
              continue
            }
            // A concrete child selects a different data node. Its index does not imply
            // a root-store field; only wildcard child keys can become compound fields.
            if (segments.some(segment => !segment.startsWith('$'))) {
              issues.push({ kind: 'uncertain', store: store.store, rulesPath, detail: `Nested literal rule path needs an explicit Local mapping for ${field}.` })
              uncertain = true
              continue
            }
            const path = [...segments.map(segment => segment.slice(1)), fieldPath(field)]
            expected.set(key(path), { path, rulesPath, field })
          }
        }
      }
      for (const [segment, child] of Object.entries(node)) {
        if (!segment.startsWith('.')) visit(child, [...segments, segment])
      }
    }
    visit(root)
    const actual = (store.storeSchema ?? []).filter(index => index && (typeof index.keypath === 'string' ||
      (Array.isArray(index.keypath) && index.keypath.every(part => typeof part === 'string'))))
    const actualKeys = new Set(actual.map(index => key(index.keypath)))
    for (const [pathKey, entry] of expected) {
      if (actualKeys.has(pathKey)) continue
      const suggestedName = entry.path.join('_')
      const incorrect = actual.find(index => index.name === suggestedName)
      issues.push({
        kind: incorrect ? 'incorrect' : 'missing',
        store: store.store,
        path: entry.path.join(' + '),
        rulesPath: entry.rulesPath,
        index: incorrect?.name,
        actual: incorrect?.keypath
      })
    }
    // Each visited wildcard path permits its ordered Local prefix index.
    // Unique Local indexes encode identity, which Rules cannot specify.
    if (uncertain) continue
    for (const index of actual) {
      const parts = typeof index.keypath === 'string' ? [index.keypath] : index.keypath
      const pathKey = key(parts)
      if (index.options?.unique || expected.has(pathKey) || wildcardPaths.has(pathKey) ||
        (parts.length === 1 && wildcardFields.has(parts[0])) ||
        isDeclaredPrefix(parts, [...expected.values()])) continue
      if (issues.some(issue => issue.kind === 'incorrect' && issue.store === store.store && issue.index === index.name)) continue
      issues.push({ kind: 'extra', store: store.store, index: index.name, path: parts.join(' + ') })
    }
  }
  return issues
}

// Parse the rules as a parenthesized JavaScript object solely to locate JSON values.
// The wrapper shifts first-line columns by one; account for that in the message.
function rulesLocations(source) {
  const ast = espree.parse(`(${source})`, { ecmaVersion: 'latest', sourceType: 'script', loc: true })
  const root = ast.body[0]?.expression
  const find = (node, path) => path.reduce((current, segment) => get(current, segment), node)
  return path => {
    const node = find(root, ['rules', ...path.split('/')]) ?? find(root, path.split('/'))
    if (!node) return ''
    return ` (${node.loc.start.line}:${node.loc.start.column - (node.loc.start.line === 1 ? 1 : 0)})`
  }
}

export const localStoresRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Verify existing Local indexes against configured Firebase Realtime Database rules' },
    schema: [],
    messages: {
      config: 'Set settings.redequateDatabase.firebaseRules (or REDEQUATE_FIREBASE_RULES) to the application database.rules.json to verify Local indexes.',
      rules: 'Cannot read Firebase rules at {{path}}: {{reason}}.',
      missing: 'Local store {{store}} is missing index for {{path}} required by Firebase {{rulesPath}}{{rulesLocation}}.',
      incorrect: 'Local store {{store}} index {{index}} has keypath {{actual}}; Firebase {{rulesPath}}{{rulesLocation}} requires {{path}}.',
      extra: 'Local store {{store}} index {{index}} ({{path}}) has no matching Firebase .indexOn declaration, wildcard path key, or documented prefix derivation.',
      uncertain: 'Cannot verify Local store {{store}} against Firebase {{rulesPath}}{{rulesLocation}}: {{detail}}'
    }
  },
  create(context) {
    return {
      Program(program) {
        let stores
        try { stores = JSON.parse(context.sourceCode.text) } catch { return }
        if (!Array.isArray(stores)) return
        const settings = context.settings?.redequateDatabase ?? {}
        const configured = settings.firebaseRules ?? process.env.REDEQUATE_FIREBASE_RULES
        const path = settings.rulesConfig ?? process.env.REDEQUATE_RULES_CONFIG ?? configured ?? 'Redequate base Rules'
        let rules; let source; let locate
        try {
          const loaded = loadRules(settings)
          rules = loaded.rules
          source = configured ? readFileSync(resolve(configured), 'utf8') : loaded.source
          locate = rulesLocations(source)
        } catch (error) {
          context.report({ node: program, messageId: 'rules', data: { path, reason: error.message } })
          return
        }
        const entries = program.body[0]?.expression?.elements ?? []
        const byName = new Map(entries.map(node => [literal(get(node, 'store')), node]))
        for (const issue of compareStoresWithRules(stores, rules)) {
          const storeNode = byName.get(issue.store)
          const indexes = get(storeNode, 'storeSchema')?.elements ?? []
          const indexNode = indexes.find(node => literal(get(node, 'name')) === issue.index)
          const target = indexNode
            ? get(indexNode, 'keypath') ?? indexNode
            : get(storeNode, 'storeSchema') ?? get(storeNode, 'store') ?? storeNode ?? program
          context.report({
            node: target,
            messageId: issue.kind,
            data: {
              ...issue, actual: JSON.stringify(issue.actual), rulesLocation: issue.rulesPath ? locate(issue.rulesPath) : ''
            }
          })
        }
      }
    }
  }
}

export default { rules: { 'local-stores': localStoresRule } }
