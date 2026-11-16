/** Conservative static checks for the two current database providers. */
export const UNKNOWN = Symbol('dynamic database expression')

const own = (value, key) => value != null && Object.hasOwn(value, key)
const fieldsOf = index => Array.isArray(index.keypath) ? index.keypath : [index.keypath]
const issue = (code, message, segment, suggestions = []) => ({ code, message, segment, suggestions })
const named = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1
const pathValue = value => typeof value === 'string'
  ? value
  : Array.isArray(value) && value.every(part =>
    typeof part === 'string' || (named(part) && typeof Object.values(part)[0] === 'string'))
    ? value.map(part => typeof part === 'string' ? part : Object.values(part)[0]).join('/')
    : UNKNOWN
const range = options => [options.equalTo, options.start, options.end].some(value => value !== undefined && value !== UNKNOWN)
const validBound = value => value === null || typeof value === 'boolean' || typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value))
const invalidSegment = part => {
  if (part === UNKNOWN) return false
  if (typeof part === 'string') return !part
  return !named(part) || Object.entries(part).some(([name, value]) =>
    !name || (value !== UNKNOWN && (typeof value !== 'string' || !value)))
}

export function analyzePath({ path, options = {}, operation = 'read', provider, stores = [], rules } = {}) {
  if (!['local', 'firebase'].includes(provider) || path === UNKNOWN || path === undefined) return []
  if (typeof path !== 'string' && !Array.isArray(path)) return [issue('path', 'Database path must be a string or array.', 0)]
  const literal = typeof path === 'string'
  const parts = literal ? path.split('/').filter(Boolean) : path
  if (!parts.length) return operation === 'read' ? [issue('path', 'Read path must be non-empty.', 0)] : []
  const invalid = parts.findIndex(invalidSegment)
  if (invalid >= 0) return [issue('path', 'A path segment must be a non-empty string or one named non-empty string value.', invalid)]
  if (parts[0] === UNKNOWN || (named(parts[0]) && Object.values(parts[0])[0] === UNKNOWN)) return []
  const first = parts[0]
  if (typeof first !== 'string') return []
  const result = []
  const field = options.orderBy === undefined || options.orderBy === UNKNOWN ? options.orderBy : pathValue(options.orderBy)
  if (options.order !== undefined && options.order !== UNKNOWN && !['asc', 'desc'].includes(options.order)) {
    result.push(issue('order', 'Order must be asc or desc.', 'order'))
  }
  if (options.equalTo !== undefined && options.equalTo !== UNKNOWN &&
      [options.start, options.end].some(value => value !== undefined && value !== UNKNOWN)) {
    result.push(issue('bounds', 'equalTo cannot be combined with start or end.', 'equalTo'))
  }
  for (const name of ['equalTo', 'start', 'end']) {
    const value = options[name]
    if (value !== undefined && value !== UNKNOWN && !validBound(value)) {
      result.push(issue('bound', `${name} must be null, a boolean, finite number or string.`, name))
    }
  }
  if (field === UNKNOWN && options.orderBy !== UNKNOWN) {
    const orderBy = options.orderBy
    const dynamic = Array.isArray(orderBy) && orderBy.some(part => part === UNKNOWN ||
      (named(part) && Object.values(part)[0] === UNKNOWN))
    if (!dynamic) result.push(issue('orderBy-path', 'orderBy must be a string or an array of valid path segments.', 'orderBy'))
  }
  if (Array.isArray(options.orderBy)) {
    const invalidOrderBy = options.orderBy.findIndex(invalidSegment)
    if (invalidOrderBy >= 0 && !result.some(item => item.code === 'orderBy-path')) {
      result.push(issue('orderBy-path', 'orderBy contains an invalid path segment.', 'orderBy'))
    }
  }
  if (field === undefined && options.start !== UNKNOWN && options.end !== UNKNOWN) {
    for (const name of ['start', 'end']) {
      if (options[name] !== undefined && typeof options[name] !== 'string') {
        result.push(issue('key-bound', `Key ${name} must be a string without orderBy.`, name))
      }
    }
  }
  if (provider === 'firebase') {
    if (!rules) return []
    let node = rules.rules ?? rules
    let known = true
    const queryParts = (operation === 'read' || operation === 'cursor') && !literal && parts.length > 1 &&
            typeof parts.at(-1) === 'string'
      ? parts.slice(0, -1)
      : parts
    for (let i = 0; i < queryParts.length; i++) {
      const part = parts[i]
      // An array string is an identity placeholder, not a literal child name.
      const value = typeof part === 'string' ? part : Object.values(part)[0]
      const variable = (!literal && i > 0 && typeof part === 'string') || /\{[^{}]+\}/.test(value)
      if (variable) {
        const wildcards = Object.keys(node ?? {}).filter(key => key.startsWith('$'))
        if (wildcards.length !== 1) { known = false; break }
        node = node[wildcards[0]]
      } else if (node && own(node, value)) node = node[value]
      else {
        const wildcards = Object.keys(node ?? {}).filter(key => key.startsWith('$'))
        if (wildcards.length === 1) node = node[wildcards[0]]
        else if (wildcards.length > 1 || (node && (own(node, '.read') || own(node, '.write')))) { known = false; break } else { result.push(issue('firebase-path', `No Firebase rules path for ${parts.slice(0, i + 1).map(String).join('/')}.`, i)); known = false; break }
      }
    }
    if (known && field !== undefined && field !== UNKNOWN && field !== '' &&
            ![node?.['.indexOn']].flat().includes(field)) {
      result.push(issue('firebase-index', `No Firebase .indexOn for ${field} at this query path.`, 'orderBy',
        [node?.['.indexOn']].flat().filter(value => typeof value === 'string')))
    }
    return result
  }
  const store = stores.find(entry => entry.store === first)
  if (!store) return [issue('store', `Unknown Local store ${first}.`, 0, stores.map(entry => entry.store))]
  const indexes = store.storeSchema ?? []
  const available = [...new Set(indexes.flatMap(fieldsOf))]
  const conditions = {}
  const end = (operation === 'read' || operation === 'cursor') && !literal && parts.length > 1 && typeof parts.at(-1) === 'string'
    ? parts.length - 1
    : parts.length
  if (end !== parts.length && indexes.length && parts.at(-1) !== '_id' && !available.includes(parts.at(-1))) {
    result.push(issue('identity', `No Local identity index for ${first}.${parts.at(-1)}.`, parts.length - 1, ['_id', ...available]))
  }
  let property = false
  for (let i = 1; i < end && indexes.length; i++) {
    const part = parts[i]
    if (typeof part === 'string') { property = true; continue }
    const [name, value] = Object.entries(part)[0]
    if (property) continue
    if (name === '_id' || available.includes(name)) conditions[name] = value
    else if (!Object.keys(conditions).length) result.push(issue('index', `No Local index for ${first}.${name}.`, i, ['_id', ...available]))
    else property = true
  }
  if (property && Object.keys(conditions).length && !own(conditions, '_id') && !indexes.some(index =>
    index.options?.unique && fieldsOf(index).every(name => own(conditions, name)))) {
    result.push(issue('nonunique-property', `Nested property requires a unique Local record path in ${first}.`, end - 1))
  }
  if (field !== undefined && field !== UNKNOWN && field !== '' && indexes.length) {
    const normalized = field.replaceAll('/', '.')
    const matching = indexes.filter(index => fieldsOf(index).includes(normalized))
    if (!matching.length) result.push(issue('orderBy', `No Local index for ${first}.${field} orderBy.`, 'orderBy', available))
    else if (range(options) && !matching.some(index => fieldsOf(index).slice(0, fieldsOf(index).indexOf(normalized))
      .every(name => own(conditions, name)))) {
      result.push(issue('range', `Local range on ${field} requires preceding compound index fields in the path.`, 'orderBy'))
    }
  }
  if (!indexes.length && range(options)) result.push(issue('query', `Unindexed Local store ${first} does not support query bounds.`, 'orderBy'))
  return result
}
