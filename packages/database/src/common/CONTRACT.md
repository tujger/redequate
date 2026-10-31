# Database and Cursor behavioral contract

This describes the public behavior implemented by `DatabaseBase`, `FirebaseDatabase`,
`LocalDatabase`, and their cursors. The Firebase adapter is the reference for
query and event behavior. The shared scenarios are exercised against the real
Auth/Realtime Database emulators and Local IndexedDB. Run both providers:

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
  with `/`. Firebase uses that resulting address. Local uses
  `path[0]` as a configured physical object store; named segments retain their
  field name as part of Local identity. Root reads
  (`''`, `[]`) are invalid; root cursors are valid.
- Array `read`, `cursor` and `addEventListener` paths share a grammar: a trailing string in
  an array of two or more segments is the collection's identity field. Firebase
  drops that segment before addressing the database; Local selects children with
  that named identity (fixed or dynamic) and assembles them by its values.
  `read(["users_public", "user_id"])` therefore reads Firebase `/users_public`
  and the Local user_id collection. Local does not include unrelated identity
  fields from the same physical store. Nested collections use the same rule.
- Internal backend `database.read` requests use the same collection-path grammar.
  `read(["_activity", "activity_type_id"], {orderBy: ["type"], equalTo: "tag.create"})`
  returns a map of matching records keyed by ID, or null when absent. A final
  string is identity metadata; a scalar field must use a named final segment,
  such as `["posts", {post_id: id}, {uid: "uid"}]`. Local singleton stores retain
  their document addressing; literal string paths remain literal.
- A trailing named segment selects a record and its descendants:
  `read(["users_public", {user_id: uid}])` addresses Firebase `/users_public/<uid>`.
  Concrete fields/branches use named segments too: `read(["meta", {settings:
  "settings"}])` addresses `/meta/settings`, and `read(["users_public", {user_id:
  uid}, {email: "email"}])` reads the scalar email. Local accepts existing literal
  branches and embedded fields through this explicit syntax, without rewriting
  stored rows. Named selection also matches the corresponding dynamic identity.
- A one-element array reads its root collection. String paths remain literal,
  including their final segment. This grammar does not change create,
  update, delete, or orderBy path normalization. Listener initial values use
  the same selection as read, including Local child identity filtering.
- `read` returns plain values or `undefined` when absent. Query options apply to
  immediate children of the resulting address, after removing the identity-field
  marker. Property enumeration from `read` is not a cursor order guarantee.
  `orderBy: ''` selects child values; a nonempty `orderBy` selects the nested
  field; `equalTo` without `orderBy` selects child values; otherwise range bounds
  select child keys. `order` is `asc` or `desc`; `equalTo` excludes `start`/`end`.
- `create(path, valueOrCallback)` creates only when absent and returns
  the permanent string key; its synchronous callback receives that string. Its path
  uses `DatabasePath`, with a collection path followed by a key field name or
  a named string ID segment; create validates that shape at runtime. There is
  no create options argument. The
  database's `onError` handler can suppress a create failure by returning normally,
  in which case create resolves to `undefined`. `update(path, object)` is
  a shallow merge, with null deleting fields; `update(path, callback)` atomically
  replaces and returns the final value: null deletes, undefined leaves storage unchanged. Its
  callback signature is `(value: DatabaseValue) => DatabaseValue | void`;
  no separate updater type is exported. Batch
  paths are root relative. `delete` succeeds for absent paths. Operation errors
  go to the call's `onError` or the database default; a normally returning
  handler suppresses the error and leaves an undefined result. Listeners and
  cursors retain their error handler.
- Successful object and batch updates resolve to `undefined`, as does a suppressed
  failure; their return value alone cannot distinguish those outcomes. Callback
  updates return the committed value (`null` for deletion), so `undefined` means
  a suppressed failure. If the callback returns undefined or has no return statement,
  update returns its original snapshot (null when absent) without a replacement request
  or write notification. A no-change result after a conflict returns the fresh snapshot.
  Callbacks receive copies, so mutations are discarded unless a value is returned.
  The result contract matches `cursor.handle`: null deletes, undefined leaves the
  original value unchanged, and any other value replaces it, including false, 0,
  empty strings and arrays. Update callbacks are synchronous; cursor handles may
  return a Promise.
- Provider `cursor(...)` factories and `cursor.subscribe(...)` return their handle,
  or `undefined` after a suppressed construction/registration failure. `next(...)`
  returns an entry array, or `undefined` after a suppressed page failure. `[]` is
  an exhausted page, not a failed page; check `position.finished` for completion.
  Group headings have a `key` and no `value`; data entries have both properties.
- Neither provider adds a `timestamp` field to a record. Local preserves ordinary
  data fields through create, update, and collection writes, excluding service keys. A caller
  supplied `timestamp`, including a `TIMESTAMP` marker, remains explicit data;
  queries with `orderBy: "timestamp"` still use that field, not the key.
- Without a supplied key, Firebase create uses Realtime Database push(). Local uses
  firebase-key.key() for all new automatic keys, including object values and callbacks.
  Both generate 20-character time-sortable strings. Local keys increase within one
  generator during the same millisecond and after clock rollback; cross-device clock
  synchronization and ordering by commit time are not guaranteed. Existing and supplied
  keys remain unchanged. Old numeric keys do not gain chronological ordering.
- LocalDatabase requires a supplied backend for create. It prepares the final key and
  synchronous callback result before request("database.create", preparedPath, value).
  Callback errors and invalid results prevent the request; a callback can run even when
  the subsequent save conflicts. The backend accepts only prepared record objects and
  returns the committed key or rejects. The create adapter only prepares arguments, delegates and handles operation errors;
  it does not access IndexedDB, initialize schemas or publish notifications. The
  backend operates independently on stores prepared separately.
- Failed writes roll back records, but generated logical IDs are not reserved or reused.
  Native _id stays inside Local; object reads retain all other fields, including
  fields injected from the address.
  No allocator stores or implicit timestamps are added; no data migration is performed.

## Local IndexedDB schema

`local/stores.json` and constructor `stores` define application stores, their native
primary key (`_id`, autoIncrement true), and all secondary indexes. The adapter does
not add framework indexes. Simple and compound `unique` indexes enforce uniqueness.
Additional configured stores use the same format; provider stores beginning with `$`
remain outside the application schema and cannot be changed by application CRUD.

Local object records keep fields directly, without `_record`, `_encoded`, `_local`,
added/overwritten field lists or a duplicate payload. Only the native `_id` is
omitted from object reads. All other fields remain visible, including unique and
compound index fields, nested identity fields and fields injected from the path.
A field may both identify a collection entry and appear inside its value. This
rule applies to read, cursors, subscriptions, backend reads and update callbacks.
It does not depend on which path selected the record or whether a field was
explicitly supplied. Indexed path parents must be compatible objects.
Strings, numbers, booleans and arrays use only `{_value: value}` plus physical keys;
there is no type marker. Objects with `_value` at their root are rejected, as are
legacy root fields `_record` and `_encoded`. Nested fields with these names are
allowed. `null` deletes, `undefined` is rejected, and create requires an object.
Old wrappers reject with `VersionError`; there is no automatic conversion or deletion.
Index definitions do not change.

Named field lookups use declared indexes or the native `_id` primary key. A compound
index can address a full unique record or a prefix scope. Explicit identity fields
select keys for returned collections; otherwise a suitable unique index determines
the key, falling back to the native primary key for a full collection read. An
unindexed search field, ambiguous record lookup, or unsupported range raises
`database/invalid-argument`; there is no synthetic lookup index or encoded-path scan.
Literal string record paths require an unambiguous unique index.

A store with no secondary indexes is intentionally a single small document. Read it
as a whole, or access its fields (for example `meta/settings`); field writes update
that document. It supports neither record searches nor query bounds/order fields.
Multiple physical records in an unindexed store are rejected instead of guessed or
merged. Deleting the store path clears the document; deleting a field removes only
that property. No schema indexes are added to make these stores searchable.

CRUD writes are native IndexedDB transactions. Local update uses the injected backend:
Database prepares the complete value from a backend read snapshot, then requests an
ETag-conditional replacement. Both providers prepare their paths and batch encoding, then call super.update.
The provider owns the single error boundary and original error context; DatabaseBase
validates prepared arguments and routes through _backend. common/methods/update
handles complete-value preparation and retries.
Object changes shallow-merge at the target address; supplied child objects replace
their previous values. Relative keys with / update nested addresses. Neither provider
constructs a fallback backend for update. Firebase object updates require read and
write permission. Synchronous
callbacks replace the whole value and may rerun on conflict, up to 25 attempts.
Callback failures prevent replacement; native index errors roll back the transaction.
Local update does not initialize schema or open IndexedDB itself. Cross-store
batches commit atomically, overlapping addresses reject, and timestamp/increment
markers resolve during the write. Increment markers come from `backend.increment(n)`;
Database has no `increment` method. Firebase markers are JSON-compatible objects.
Local markers are symbols whose deltas are kept in a module-owned Map. They work
within one JS space and can be reused. Neither marker is a callback.
Backend creates and updates notify observers only after commit.
Listeners refresh collection snapshots from native rows; cross-context messages carry
only changed collection names. No path metadata is stored or transmitted.

`applySchema` adds declared stores/indexes and can replace non-required index
definitions atomically. Configured indexes and store keyPath/autoIncrement settings
are protected. Existing rows and unrelated native indexes are not rewritten or
removed. Schema updates neither compact nor migrate old record formats. New stores
introduced only through applySchema do not become configured CRUD collections.

The previous metadata-based local format is no longer supported. There is no migration,
automatic data deletion, compatibility decoder, startup conversion or Dispatcher hook.
Use a separate clean database for this format; existing user databases are not modified
by the development/test workflow.

## Cursor query and traversal

- A cursor visits immediate children. Default ordering is by child key. A
  nonempty `orderBy` orders by the selected child field; `orderBy: ''`, or
  `equalTo` with no `orderBy`, orders by child value. The Firebase cursor omits
  children for which a nonempty ordered field does not exist. That includes
  a null field, since Realtime Database treats a null write as deletion. Local
  cursor applies the same membership rule even if a stored record contains
  an explicit null. This is verified by both providers. This cursor membership
  rule differs from `read`: a null-equality field read includes children with an
  absent/null field, as confirmed by the shared emulator scenario.
- The SDK key comparator recognizes signed 32-bit integer-looking keys,
  including leading zeros, and places them before other keys. It compares
  integer values first, then key length for equal values; noninteger keys use
  lexicographic order. Distinct equal-value integer spellings of equal length
  compare equal in the SDK comparator, so their relative order is unresolved.
  The installed SDK source confirms the comparator.
  `compareKeys` is shared by Local key ordering and bounds. The shared emulator scenario checks
  `"2"`, `"02"`, and `"10"` end to end.
- For field and value queries, the SDK compares absent/null nodes, booleans,
  numbers, strings, then objects; equal sort values break ties by child key.
  Arrays and objects have the same rank and tie by child key, regardless of
  their contents. `DESC` reverses the complete `(value, key)` order. Shared
  scenarios verify mixed types, nested fields and object/array ties in both
  directions, including single-entry pages. Object-valued public query bounds
  are rejected. Firebase also rejects an object continuation bound, so its
  cursor uses the original query plus tuple filtering after an object boundary;
  this exceptional path materializes the query. Local uses the same comparator for scalar and object/array sorting after
  reading the collection rows.
- `start`, `end`, and `equalTo` are inclusive SDK query bounds. `start: "Al"`
  without `end` expands to an inclusive `"Al\uf8ff"` end in **cursor** queries.
  Explicit `end` remains exact. Firebase `startDate` and `endDate` generate
  timestamp key limits. Local date bounds inclusively compare the record's
  explicit finite numeric `timestamp` field (or a Date value) in milliseconds;
  records without a valid timestamp are excluded. They also filter field/value
  queries before `handle`. Date bounds are not part of
  `read` options. Bounds permit null, booleans, finite numbers and strings at
  the common cursor API; key-order bounds must be strings. Null, boolean and
  numeric key bounds are rejected by both providers. `equalTo: null` remains an
  explicit equality condition and is never treated as an unspecified bound.
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
  child moved before the continuation can be missed. Both atomic provider cursors
  resume by the captured `(value, key)` tuple and can revisit a processed child
  moved later. Its handler then runs again. The public composition deduplicates
  returned entries by source path and key, after source handlers run. These
  behaviors are verified independently on atomic and public cursors in ASC/DESC.
  A handler that keeps moving an entry later on every visit can prevent exhaustion;
  traversal during writes is not snapshot-stable.
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
  call-time handoff. `remove()` idempotently detaches the independent listener.
- `cursor.subscribe` makes an independent child-event subscription on the
  cursor query. Initial query children form a silent baseline; subsequent
  membership transitions produce `{type: 'add'|'change'|'remove', entry}`.
  The Firebase adapter tracks ordered-field appearance/disappearance as add
  or remove. Subscriptions update `count` before calling listeners. Each
  subscription is an independent handle with its own time, active state and
  event counters; its `id` identifies the owning cursor and is shared by
  subscriptions of that cursor;
  `unsubscribe()` is idempotent. Live events do not advance `position` or
  cancel an in-flight `next` page.

Local listener registration uses the shared error boundary: an exception from
`onError` propagates once, and a suppressed registration failure returns `undefined`
without a dummy subscription. Asynchronous Local delivery reports exceptions from
`onError` through the host's `reportError` (or an uncaught microtask exception when
unavailable). It does not invoke `onError` again, stop other listeners, or reject an
already committed backend write. Callback promises are observed without blocking
listener queues, so callbacks can perform writes. Completed queue tails are released;
unsubscribing does not discard pending work or break ordering on resubscription.

## Verification and limits

The emulator suites run locally with Node 24.21.0 and Java 17. The normal shell's
Node 20 fails while loading Firebase CLI's ESM dependency. Sandbox loopback
binding fails with `EPERM`; an approved execution outside the sandbox successfully
runs the emulators on 127.0.0.1:9099 and :9000 (hub/logging: 4400/4500).
The contract fixture uses the permitted `database_test` path. Firebase integration
failures are reported as failures, never skipped or treated as successful checks.

Shared tests cover keys, mixed and nested ordering, inclusive/prefix/equality
bounds, page size and traversal state, deletion/movement, handler writes and
failures, listener baselines, membership events and independent subscriptions.
Local tests additionally compare direct and nested field ordering, verify the
minimal physical index/row layout, and exercise atomic compaction and rollback.
There are no assertions requiring native cursor paging without collection scans.

There is no promised stable relative order for distinct integer spellings of the
same numeric value and length (for example `-0` and `00`): the SDK comparator
considers them equal. This rare tie is not covered by emulator regression tests.
Listener installation is not a lossless call-time handoff; writes already in the
first snapshot belong to its baseline. Cross-tab notification tests use simulated
BroadcastChannels; real browser multi-tab and Android end-to-end checks are
separate from the automated suites. Date-bound semantics intentionally differ
between Firebase push keys and Local explicit timestamps, as described above.

The Local physical database name is storageId (default redequate:local). Auth,
Storage and Messaging share it through reserved stores `$auth`, `$storage` and
`$messaging`. The `$` prefix is reserved for provider-owned stores, including future providers.
Application schemas and collection access cannot target provider stores.
Former physical database names are not migrated or deleted automatically.
