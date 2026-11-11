import { readFileSync } from 'node:fs'
import { loadRules } from '../firebase-rules.mjs'
import { analyzePath, UNKNOWN } from './schema-paths.mjs'

const stores = JSON.parse(readFileSync(new URL('../../packages/database/src/local/stores.json', import.meta.url), 'utf8'))
const propertyName = node => node?.type === 'Identifier' ? node.name : node?.type === 'Literal' ? node.value : undefined
const hasDynamic = input => input === UNKNOWN || (input && typeof input === 'object' &&
  Object.values(input).some(hasDynamic))
const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const old = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = old
    }
  }
  return row[b.length]
}
const closeCandidates = (actual, candidates) => {
  const matches = [...new Set(candidates)].filter(candidate => typeof candidate === 'string' &&
    candidate !== actual && distance(actual, candidate) <= 2)
  return matches.length === 1 ? matches : []
}
const indexedFields = (provider, path, options, stores, rules, operation, diagnostic) => {
  if (provider === 'firebase') return diagnostic.suggestions.filter(field => field !== '.value')
  const store = stores.find(entry => entry.store === (Array.isArray(path) ? path[0] : path.split('/').filter(Boolean)[0]))
  if (!store) return []
  return [...new Set((store.storeSchema ?? []).flatMap(index =>
    (Array.isArray(index.keypath) ? index.keypath : [index.keypath]).filter(field => typeof field === 'string')))]
    .filter(field => !analyzePath({ path, options: { ...options, orderBy: field }, operation, provider, stores, rules })
      .some(item => item.code === 'orderBy' || item.code === 'range'))
}

function replacements({ diagnostic, path, options, operation, provider, rules, pathNode, optionsNode }) {
  if (hasDynamic(path) || hasDynamic(options)) return []
  const proposed = []
  if (diagnostic.segment === 'orderBy' && ['orderBy', 'firebase-index'].includes(diagnostic.code)) {
    const orderNode = optionsNode?.type === 'ObjectExpression' && optionsNode.properties.find(item =>
      item.type === 'Property' && !item.computed && propertyName(item.key) === 'orderBy')?.value
    if (!orderNode || !['Literal', 'ArrayExpression'].includes(orderNode.type) ||
      (orderNode.type === 'Literal' && typeof orderNode.value !== 'string') ||
      (orderNode.type === 'ArrayExpression' && !orderNode.elements.every(item =>
        item?.type === 'Literal' && typeof item.value === 'string'))) return []
    const fields = indexedFields(provider, path, options, stores, rules, operation, diagnostic)
    for (const field of fields) {
      const pathField = provider === 'local' ? field.replaceAll('.', '/') : field
      const replacement = orderNode.type === 'ArrayExpression' ? pathField.split('/') : pathField
      if (replacement === options.orderBy || JSON.stringify(replacement) === JSON.stringify(options.orderBy)) continue
      proposed.push({
        label: field,
        node: orderNode,
        text: JSON.stringify(replacement),
        path,
        options: { ...options, orderBy: replacement }
      })
    }
  } else if (typeof diagnostic.segment === 'number') {
    const i = diagnostic.segment
    const part = Array.isArray(path) ? path[i] : path.split('/').filter(Boolean)[i]
    if (typeof part !== 'string' && !(part && typeof part === 'object')) return []
    let candidates = []
    if (diagnostic.code === 'store') candidates = closeCandidates(part, diagnostic.suggestions)
    if (diagnostic.code === 'identity' && Array.isArray(path)) {
      const store = stores.find(entry => entry.store === path[0])
      candidates = closeCandidates(part, ['_id', ...(store?.storeSchema ?? [])
        .filter(index => index.options?.unique && typeof index.keypath === 'string').map(index => index.keypath)])
    }
    if (diagnostic.code === 'index' && Array.isArray(path) && part && typeof part === 'object') {
      candidates = closeCandidates(Object.keys(part)[0], diagnostic.suggestions)
    }
    // Rules enumerate query structure, not data fields. Only a misspelled root
    // with no wildcard/permission fallback has a safe structural alternative.
    if (diagnostic.code === 'firebase-path' && i === 0 && typeof part === 'string') {
      const root = rules?.rules ?? rules
      candidates = closeCandidates(part, Object.keys(root ?? {}).filter(key => !key.startsWith('.') && !key.startsWith('$')))
    }
    for (const candidate of candidates) {
      if (Array.isArray(path)) {
        const element = pathNode?.type === 'ArrayExpression' && pathNode.elements[i]
        if (!element) continue
        const replacement = [...path]
        let node = element; let text = JSON.stringify(candidate)
        if (typeof part === 'object') {
          const property = element.type === 'ObjectExpression' && element.properties[0]
          if (!property || property.type !== 'Property' || property.computed || property.shorthand) continue
          node = property.key
          text = property.key.type === 'Identifier' && /^[A-Za-z_$][\w$]*$/.test(candidate) ? candidate : JSON.stringify(candidate)
          replacement[i] = { [candidate]: Object.values(part)[0] }
        } else replacement[i] = candidate
        proposed.push({ label: candidate, node, text, path: replacement, options })
      } else if (pathNode?.type === 'Literal' && typeof pathNode.value === 'string' && i === 0) {
        const segments = path.split('/')
        const position = segments.findIndex(Boolean)
        segments[position] = candidate
        proposed.push({ label: candidate, node: pathNode, text: JSON.stringify(segments.join('/')), path: segments.join('/'), options })
      }
    }
  }
  return proposed.filter(item => !analyzePath({ path: item.path, options: item.options, operation, provider, stores, rules })
    .some(problem => problem.code === diagnostic.code && problem.segment === diagnostic.segment))
    .map(item => ({
      messageId: 'replace',
      data: { field: item.label },
      fix: fixer => fixer.replaceText(item.node, item.text)
    }))
}

function value(node) {
  if (!node) return undefined
  if (node.type === 'Literal') return node.value
  if (node.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked
  if (node.type === 'Identifier' && node.name === 'undefined') return undefined
  if (node.type === 'ArrayExpression') return node.elements.map(item => item ? value(item) : UNKNOWN)
  if (node.type === 'ObjectExpression') {
    const result = {}
    for (const item of node.properties) {
      if (item.type !== 'Property' || item.computed) return UNKNOWN
      const key = propertyName(item.key)
      if (key === undefined) return UNKNOWN
      result[key] = value(item.value)
    }
    return result
  }
  return UNKNOWN
}

const configuredRules = context => loadRules(context.settings?.redequateDatabase).rules

export const databaseQueries = {
  meta: {
    type: 'problem',
    docs: { description: 'Validate statically known Local and Firebase database query paths' },
    schema: [],
    hasSuggestions: true,
    messages: { config: 'Cannot resolve Firebase Rules: {{reason}}', invalid: '{{message}}{{hint}}', replace: 'Use {{field}}' }
  },
  create(context) {
    const imports = new Map(); const bindings = new Map()
    let rules; let configurationError
    try { rules = configuredRules(context) } catch (error) { configurationError = error.message }
    const providerOf = node => {
      if (node?.type === 'Identifier') return bindings.get(node.name)
      if (node?.type === 'NewExpression' && node.callee.type === 'Identifier') {
        const provider = imports.get(node.callee.name)
        if (provider === 'local' && node.arguments[0]) {
          const options = node.arguments[0]
          if (options.type !== 'ObjectExpression' || options.properties.some(item => item.type !== 'Property' ||
              propertyName(item.key) === 'stores')) return undefined
        }
        return provider
      }
      return undefined
    }
    return {
      Program(node) {
        if (configurationError) context.report({ node, messageId: 'config', data: { reason: configurationError } })
      },
      ImportDeclaration(node) {
        // Recognize only explicit provider imports. Generic DatabaseBase or context.database remains unknown.
        for (const specifier of node.specifiers) {
          const name = specifier.local?.name
          if (!name) continue
          const source = node.source.value
          if (/database\/src\/local(?:\/index)?$|(?:^|\/)database\/local$/.test(source) ||
                        (/(?:^|\/)local(?:\/index)?$/.test(source) && name === 'LocalDatabase')) imports.set(name, 'local')
          if (/database\/src\/firebase(?:\/index)?$|(?:^|\/)database\/firebase$/.test(source) ||
                        (/(?:^|\/)firebase(?:\/index)?$/.test(source) && name === 'FirebaseDatabase')) imports.set(name, 'firebase')
        }
      },
      VariableDeclarator(node) {
        const provider = providerOf(node.init)
        if (node.id.type === 'Identifier' && provider) bindings.set(node.id.name, provider)
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.computed ||
                    !['read', 'cursor'].includes(callee.property.name)) return
        const provider = providerOf(callee.object)
        if (!provider || (provider === 'firebase' && !rules)) return
        const path = value(node.arguments[0])
        if (path === UNKNOWN) return
        const options = value(node.arguments[1])
        if (options === UNKNOWN || (options !== undefined && (options === null || typeof options !== 'object' || Array.isArray(options)))) return
        for (const diagnostic of analyzePath({ path, options, operation: callee.property.name, provider, stores, rules })) {
          const target = diagnostic.segment === 'orderBy' && node.arguments[1]?.type === 'ObjectExpression'
            ? node.arguments[1].properties.find(item => item.type === 'Property' && propertyName(item.key) === 'orderBy')?.value ?? node
            : typeof diagnostic.segment === 'number' && node.arguments[0]?.type === 'ArrayExpression'
              ? node.arguments[0].elements[diagnostic.segment] ?? node.arguments[0]
              : node.arguments[0] ?? node
          context.report({
            node: target,
            messageId: 'invalid',
            suggest: replacements({
              diagnostic,
              path,
              options: options ?? {},
              operation: callee.property.name,
              provider,
              rules,
              pathNode: node.arguments[0],
              optionsNode: node.arguments[1]
            }),
            data: {
              message: diagnostic.message,
              hint: diagnostic.suggestions.length ? ` Available fields: ${diagnostic.suggestions.join(', ')}.` : ''
            }
          })
        }
      }
    }
  }
}

export default { rules: { 'database-queries': databaseQueries } }
