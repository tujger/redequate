# Database and Cursor behavioral contract

This describes the public behavior implemented by `DatabaseBase`, `FirebaseDatabase`,
`LocalDatabase`, and their cursors. The Firebase adapter is the reference for
query and event behavior. "SDK checked" below means the installed Firebase
Realtime Database SDK's key and node comparators were inspected; it does **not**
mean an emulator observation. Run the shared scenarios against both providers:

```sh
npx vitest run --config src/__tests__/vitest.config.mjs packages/database/src/__tests__/local/LocalContract.test.js
npm run test:integration
```

The second command starts the Auth and Realtime Database emulators and includes
`FirebaseContract.integration.test.js`. It fails when they cannot start; no
Firebase case is silently skipped. Ordinary `npm run test:unit` excludes every
`*.integration.test.js` file.

## Paths and values

- Paths are strings or arrays of nonempty string segments and named segments
  with exactly one nonempty string value. `resolvePath` joins the segment values
  with `/` and ignores `_`. Firebase uses that resulting address. Local uses
  `path[0]` as a physical version-1 object store; named segments retain their
  field name and optional dynamic level as part of Local identity. A literal
  string after a named segment can address a field. A trailing string without
  a named parent addresses a literal path, rather than selecting a record by
  its named identity. Root reads (`''`, `[]`) are invalid; root cursors are valid.
- `read` returns the value at the exact path or `undefined` when absent. Query
  options apply to immediate children. Object property enumeration order from
  `read` is not a cursor order guarantee. `orderBy: ''` selects child values;
  a nonempty `orderBy` selects the nested field; `equalTo` without `orderBy`
  selects child values; otherwise range bounds select child keys. `order` is
  `asc` or `desc` and `equalTo` excludes `start`/`end`.
- `create` returns a draft without writing. `save` creates only when absent;
  its synchronous callback receives the final key. `update(path, object)` is
  a shallow merge, with null deleting fields; `update(path, callback)` atomically
  replaces and returns the final value, with null or undefined deleting. Batch
  paths are root relative. `delete` succeeds for absent paths. Operation errors
  go to the call's `onError` or the database default; a normally returning
  handler suppresses the error and leaves an undefined result. Listeners and
  cursors retain their error handler.
- Neither provider adds a `timestamp` field to a record. Local preserves the
  caller's value shape through create, update, and collection writes. A caller
  supplied `timestamp`, including a `TIMESTAMP` marker, remains explicit data;
  queries with `orderBy: "timestamp"` still use that field, not the key.
- Without a supplied key, Firebase `create` uses Realtime Database `push()` and
  Local `create` uses `firebase-key`'s `key()` to generate a Firebase-compatible
  20-character push key. A supplied key is used unchanged, including non-push
  keys. The synchronous create callback receives the draft's final key.
  `firebase-key`'s `milliseconds(pushKey)` or `date(pushKey)` can recover the
  key's encoded client-side generation time **when the key is known to be a
  push key**. This is not the server commit time. The library does not verify
  provenance: applying it to an arbitrary key may throw or decode unrelated
  data. Its inverse is `key(timestampOrDate, "min"|"max"|"random")`; it
  generates a key or a range boundary, not the original key from a timestamp.

## Cursor query and traversal

- A cursor visits immediate children. Default ordering is by child key. A
  nonempty `orderBy` orders by the selected child field; `orderBy: ''`, or
  `equalTo` with no `orderBy`, orders by child value. The Firebase cursor omits
  children for which a nonempty ordered field does not exist. That includes
  a null field, since Realtime Database treats a null write as deletion. Local
  cursor applies the same membership rule even if a stored record contains
  an explicit null. This is verified by Local shared tests; the corresponding
  Firebase emulator cases still need to run.
- The SDK key comparator recognizes signed 32-bit integer-looking keys,
  including leading zeros, and places them before other keys. It compares
  integer values first, then key length for equal values; noninteger keys use
  lexicographic order. Distinct equal-value integer spellings of equal length
  compare equal in the SDK comparator, so their relative order is unresolved.
  The installed SDK source confirms the comparator.
  `compareKeys` is shared by Local key ordering and bounds, and Local's index
  encoding uses the same integer parser. The shared emulator scenario checks
  `"2"`, `"02"`, and `"10"` end to end.
- For field and value queries, the SDK compares absent/null nodes, booleans,
  numbers, strings, then objects; equal sort values break ties by child key.
  `DESC` reverses the complete `(value, key)` order. The shared scenarios
  cover absent/null, boolean, number, and string fields; object-valued query
  bounds and object tie behavior remain unverified end to end.
- `start`, `end`, and `equalTo` are inclusive SDK query bounds. `start: "Al"`
  without `end` expands to an inclusive `"Al\uf8ff"` end in **cursor** queries.
  Explicit `end` remains exact. `startDate` and `endDate` generate timestamp
  key limits; the end includes the full millisecond. These key limits also
  filter field/value queries before `handle`. Date bounds are not part of
  `read` options. Bounds permit null, booleans, finite numbers and strings at
  the common cursor API; the Firebase SDK may reject a bound incompatible
  with key ordering, so callers should use string key bounds.
- `next(n)` requires a positive safe integer and returns up to `n` data
  entries, plus an optional one-time group heading. Handlers run sequentially
  on copies of candidate entries. Returning undefined makes no write and
  returns the original value; null deletes and omits the entry; another value
  replaces it and the cursor rereads the saved value. A replacement that no
  longer has the ordered field is omitted. `count` adds returned entries and
  delivered subscription additions, subtracts delivered removals, and counts
  repeated deliveries again. `position.index` begins at -1 and advances only
  for returned entries (including headings); `position.key` is the last
  returned key. `finished` becomes true once a scan has exhausted its query
  and any buffered entries, possibly requiring a further `next` after a full
  page. Later calls return `[]`.
- Pages are separate reads, not a transaction. A deleted boundary is included
  in the page already returned and does not block continuation. An unvisited
  child moved before the continuation can be missed. Local retains processed
  keys to avoid replay after movement; Firebase resumes using the SDK's
  ordered `(value, key)` bound and has no equivalent seen-key set. Duplicate
  behavior after an already processed child moves later is unresolved pending
  an emulator test. Do not rely on a snapshot-stable traversal during writes.
- A source list composes fresh cursors round-robin. Source options override
  outer options, including explicit undefined. It skips null sources, dedupes
  by resolved source path and child key (or cursor ID and key for pathless
  cursors), and runs each source's handler before deduplication. Group headings
  count as returned entries.

## Events

- `addEventListener` gives `onChange` the initial value (or undefined) and
  subsequent values. It does not replay existing children through
  `onChildAdd`. The Firebase adapter uses the greatest key in the first value
  snapshot as the add boundary; it emits only later additions strictly above
  that key. Child changes and removals are not limited by that boundary.
  Events already present in the initial value snapshot are baseline even if
  their child events arrived during registration. This is not a lossless
  call-time handoff. `remove()` detaches the independent listener.
- `cursor.subscribe` makes an independent child-event subscription on the
  cursor query. Initial query children form a silent baseline; subsequent
  membership transitions produce `{type: 'add'|'change'|'remove', entry}`.
  The Firebase adapter tracks ordered-field appearance/disappearance as add
  or remove. Subscriptions update `count` before calling listeners. Each
  subscription has its own `id`, time, active state and event counters;
  `unsubscribe()` is idempotent. Live events do not advance `position` or
  cancel an in-flight `next` page.

## Verification limits

The Firebase emulator could not start in the current restricted environment:
binding its loopback ports returned `EPERM`. The Firebase integration cases
therefore remain **unrun here**. The installed SDK source and adapter code
support the comparator and query descriptions, while the current Firebase
unit tests use a mock SDK and do not prove server behavior. In particular,
the shared create/key scenario remains unrun against the emulator. Emulator
validation also remains required for explicit null fields, object-valued
ordering/bounds, writes racing the first listener snapshot, cursor replay after
sort-key mutation, and query behavior for null or nonstring key bounds. Where
these are unresolved, this contract does not promise an outcome.
