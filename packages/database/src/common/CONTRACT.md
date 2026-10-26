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
  with `/` and ignores `_`. Firebase uses that resulting address. Local uses
  `path[0]` as a configured physical object store; named segments retain their
  field name and optional dynamic level as part of Local identity. Root reads
  (`''`, `[]`) are invalid; root cursors are valid.
- Array `read`, `cursor` and `addEventListener` paths share a grammar: a trailing string in
  an array of two or more segments is the collection's identity field. Firebase
  drops that segment before addressing the database; Local selects children with
  that named identity (fixed or dynamic) and assembles them by its values.
  `read(["users_public", "user_id"])` therefore reads Firebase `/users_public`
  and the Local user_id collection. Local does not include unrelated identity
  fields from the same physical store. Nested collections use the same rule.
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
  replaces and returns the final value, with null or undefined deleting. Its
  callback signature is `(value: DatabaseValue) => DatabaseValue | undefined`;
  no separate updater type is exported. Batch
  paths are root relative. `delete` succeeds for absent paths. Operation errors
  go to the call's `onError` or the database default; a normally returning
  handler suppresses the error and leaves an undefined result. Listeners and
  cursors retain their error handler.
- Neither provider adds a `timestamp` field to a record. Local preserves the
  caller's value shape through create, update, and collection writes. A caller
  supplied `timestamp`, including a `TIMESTAMP` marker, remains explicit data;
  queries with `orderBy: "timestamp"` still use that field, not the key.
- Without a supplied key, Firebase `create` uses Realtime Database `push()`.
  Local allocates a permanent numeric string
  during `create` from the native auto-increment primary key of the physical
  `path[0]` store. All logical collections in that store share this sequence.
  Allocation and record insertion commit in one IndexedDB transaction; failed
  creates roll both back. A supplied key is used unchanged. The synchronous
  create callback receives the final key after allocation and before insertion.
  The internal numeric `_id` and unique `_local.path` identity index
  are not exposed through the value API. No allocator stores are created.
  Incompatible existing databases require explicit repair; compatible schemas upgrade additively, while opening never automatically deletes data. Generated IDs need not be contiguous.
  Local does not add a timestamp field.
  Firebase generated keys remain 20-character push keys.

## Local IndexedDB schema

`local/stores.json` is the source of the built-in physical stores and indexes.
The file keeps its `store` / `storeConfig` / `storeSchema` format. Add stores or
indexes through the Local constructor, using the same format:

```js
const database = new LocalDatabase({
    storageId: "my-app",
    stores: [{
        store: "audit",
        storeConfig: {keyPath: "_id", autoIncrement: true},
        storeSchema: [
            {name: "code", keypath: "code", options: {unique: true}},
            {name: "owner_status", keypath: ["owner", "status"]}
        ]
    }]
});
await database.create(["audit", "audit_id"], key => ({code: key, status: "open"}));
```

Constructor stores require `_id` with `autoIncrement: true`. Index options support
`unique` and `multiEntry`; compound indexes cannot use `multiEntry`. Definitions
merge by store and index name. Identical repeated definitions are allowed;
conflicting definitions, reserved metadata keyPaths and invalid definitions reject
before opening IndexedDB. Inputs are copied and never modified. Additional stores
support CRUD, nested paths, cursors and subscriptions. Each instance accepts only
its own configured collections, even when another instance sharing its storageId
has created additional physical stores.

The converter adds only one framework index, `_identity`, with the unique keyPath
`_local.path`. All other indexes come from stores.json and constructor stores.
The built-in schema has 68 JSON indexes plus 18 identity indexes, for 86 total.
There are no generated cursor, scope, dynamic-type or unsupported-value indexes.
When an operation creates children without naming their identity field, it uses
the generic dynamic id; explicit and existing identities remain authoritative.

Physical object rows contain public fields directly, a numeric `_id` and sparse
`_local` reconstruction metadata. `_local.path` is the serialized named path;
the collection name comes from the physical store. `_local.added` lists injected
address fields, and `_local.originals` holds only public fields overwritten by
address projections or reserved storage fields. Objects are not copied into a
second value envelope. Primitive and array values use `_local.value`. Dynamic
levels, fixed conditions and ordering values are computed in memory when read.

Only declared native indexes require identity projections. Compound indexes
including a leaf identity may also project ancestor identities. Parent-only
identities are not copied onto every descendant row, preserving nested records
under unique parent indexes. Reads reconstruct the exact original public value,
including caller-owned `_id`, `_local` and conflicting identity fields. JSON
`unique` indexes retain native IndexedDB enforcement across each physical store;
failed writes and upgrades roll back atomically. Native IndexedDB key eligibility
applies (for example, boolean values are not native index keys).

Cursors and dynamic-type queries read the selected collection rows and apply the
shared path filtering, comparisons and ordering in memory. Each page reads fresh
values and resumes from its `(sort value, child key)` boundary. Handler writes and
subscriptions keep their existing public behavior. There is no promise of native
indexed paging or bounded collection reads; large collection queries may be slower.

Schema preparation runs before the first operation, cursor read or listener
snapshot. Concurrent operations on an instance share preparation; failures follow
the existing operation/subscription error handling and allow a later retry.
A new database creates the full merged schema at version 1. A compatible existing
schema gains missing stores/indexes in one versionchange transaction, increasing
its current version by 1 only when changes are needed. Existing records are
reprojected when an added compound index requires ancestor fields. The former
_local envelope format is compacted in place; obsolete framework indexes using
the reserved _local namespace are removed in the same transaction. Public data,
physical primary keys and unrelated native indexes are preserved. Reopening an
unchanged schema does not increase its version. Local connections close on
`versionchange`; external blockers produce an error and upgrades can be retried.
Concurrent upgrades recheck the schema before completing.

`LOCAL_SCHEMA` describes the converted built-in schema. The Local-only API
`await localDatabase.applySchema(schema)` continues to accept the physical object
format `{storeName: {keyPath, autoIncrement, indexes: {indexName: {keyPath, unique?,
multiEntry?}}}}`. It adds stores/indexes and may replace non-required indexes;
unspecified stores, non-framework indexes and records remain. Required configured indexes and
existing store keyPath/autoIncrement settings cannot be changed. Physical stores
added only through applySchema do not become configured CRUD collections.
DatabaseBase and FirebaseDatabase have no schema method.

Databases from the previous `_rowId` storage model are incompatible and must be
explicitly removed before this adapter opens them. There is no automatic deletion
or data migration from that model. For the default dev configuration, close other
connections and delete only `redequate:local` in the dev
origin's IndexedDB storage. This does not reset the separate Local Auth database.

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
