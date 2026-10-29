# Redequate Development

Persistent architectural memory: current decisions, their reasons, and constraints
that are not reliably recoverable from source alone. This is not a changelog.
Superseded implementations and individual verification runs belong in Git history
or the linked investigation reports. Development rules are in [AGENTS.md](AGENTS.md).

## 1. Project and modernization

Redequate is the core framework for an application ecosystem. Its main consumers
are the reference application `tujger/edeqa-pwa-react-demo`, production application
`tujger/thewhiskytalks`, and native client `tujger/thewhiskytalks-android`.
Cross-repository architectural decisions belong here.

The modernization sequence remains:

1. CSS Modules and UI-library isolation: completed.
2. React 19 migration and stabilization: current milestone.
3. Web build migration to Vite.
4. Full application SSR.
5. Business-oriented framework capabilities, customer demos, and customer validation.

Keep React runtime, build-system, and rendering changes independently reviewable:
`React 19 → Vite → SSR`. A successful build does not establish runtime stability
or authorize starting the next milestone.

Vite configuration already exists in both web consumers on the development
branches. This reflects separately authorized build work; it does not complete
React 19 stabilization or authorize full application SSR. Redequate still uses
Rollup for library packaging. Request-local state support exists, but full
Dispatcher/application SSR remains deferred.

Exact dependency versions and executable commands belong in
[package.json](package.json) and [README.md](README.md), rather than a second
version inventory here. Legacy peer compatibility does not imply upstream
React 19 support; installation currently uses `--legacy-peer-deps`.

## 2. Repository workflow and compatibility

Development normally uses `story/*` or `bugfix/*`; do not treat `master` as the
current development state. Check corresponding consumer branches before a
significant framework change. Prefer incremental validation through:

`redequate → edeqa-pwa-react-demo → thewhiskytalks`

Both web consumers matter: the demo exercises a controlled reference integration;
The Whisky Talks exposes production-specific behavior. Assess Android when APIs,
authentication, URLs, persisted records, callable envelopes, or application
behavior change. Browser-local storage details alone do not change native formats.

Framework installation, tests, and builds must work without sibling applications.
Consumer scripts own local linking and application security-rule validation.
Do not import a consumer's Firebase configuration or business rules into framework
tests. Framework fixtures are deliberately minimal and are not production policies.

Unit and Auth/RTDB integration tests use the framework-owned configuration and
emulator lifecycle under `src/__tests__`; see [Tests](README.md#tests).
Integration fixtures require a demo project and loopback endpoints, so missing
emulators cannot silently turn an integration test into a production request.
The runner copies rules into its temporary configuration directory and owns
emulator/watch shutdown. Restart integration watch after changing fixture rules.

Use the manifest's Node.js baseline (currently 24.12+ for framework tooling).
The Firebase CLI emulator toolchain requires Java 21+. The launcher can select
the project-specific Temurin installation for its child process; do not replace
system Java or another project's configuration to run these tests.

Builds and isolated tests complement browser/device verification. Changes around
login, media, upload, dates, routing, notifications, or PWA updates require the
corresponding consumer flow. Record the specific remaining gap instead of
presenting a passing build as proof of complete compatibility.

## 3. Build, exports, and UI boundaries

### Module formats and package ownership

Publish web ESM and CommonJS through the existing package export map. The web
entry remains `core/index.es.js`; service entries use `.mjs`/`.cjs`. Do not
change the package's default module type merely to accommodate one dependency.
Module-specific build helpers own their entries and source matching; root Rollup
configuration combines them. Runtime modules live under `packages/*/src`.

Keep browser and server packaging independent. The main package contains UI,
common, database, and client services. The maintained private
[server package](packages/server/README.md) owns its package metadata and ESM/CommonJS build. Runtime dependencies belong
to Backend manifests; consumer lockfiles pin installed versions. It exposes only
explicit common, database and server Backend subpaths; there is no root entry.
Import `DatabaseCursor` from `redequate-server/database`. Browser builds reject Node server
sources, and Node server builds reject browser and UI sources. LocalBackend
is a browser adapter shipped in `redequate`, outside `redequate-server`.

Functions install the generated server archive under the `redequate-server` dependency
name; consumers must use that name for server imports. This affects both
The Whisky Talks and demo Functions. The shared preparation script takes an
explicit Functions directory, builds/packs the archive, and refreshes installed dependency integrity. Preparation
needs the framework checkout and its build toolchain; the uploaded archive must
install independently in Cloud Build. Server runtime support is defined by its
own manifest. Do not restore the retired standalone common package or duplicate
preparation logic in each consumer.

Local Functions development can attach `packages/server/watch-redequate-server.mjs`
to a prepared Functions directory. Rollup builds into a watcher-owned temporary
directory; only successful complete cycles replace the installed package. Touching
the consumer entry point then triggers Functions reload, since Firebase ignores
`node_modules`. Each target has one watcher, owned by its development launcher or
an explicitly started command. Source edits do not repack or alter lockfiles;
changed runtime dependency requirements require preparation and a watcher restart.
The Whisky Talks enables this for developer emulator starts; isolated test runs
retain one-shot preparation. Archive deployment remains the shared consumer path.

Node Server Backends own manifests and independent build commands using the root
toolchain. `packages/server` assembles isolated outputs and merges Backend runtime
dependencies into `dist/package.json`, rejecting conflicting versions. Pack the
standalone `dist` directory (`npm run pack`), not the source manifest. The Node
archive excludes the client Firebase database adapter and its SDK dependencies.
Watch mode tracks imported sources and runtime manifests. Subpackage manifests contain only type, dependencies and build/watch commands;
these modules are not standalone npm packages and need no separate installs or
lockfiles. Functions import the Firebase backend through
`redequate-server/backend/firebase-server`; source directory names are internal.
Firebase `database.create` accepts `(path, value)` with an object value and returns
a string key. FirebaseDatabase routes create through its injected Backend or a
default FirebaseBackendClient using the same Firebase app. Synchronous value
callbacks run on the client with a supplied or locally allocated push key; the
request carries the resulting object and an explicit key path, never the callback.
The adapter maps callable `already-exists` failures to `database/conflict`.
Its grouped callable deploys as `database-create`; the Firebase client
maps that name. REST conditional PUT with the caller's ID token keeps Security
Rules authoritative, including anonymous access and validation. Like SDK
transactions, it requires read/write permission. Consumers initialize the default
Admin app; importing server entry points does not initialize Firebase.

Firebase and Local single-path `database.update` share common/methods/update.
Database reads a logical snapshot, applies Firebase-style shallow/relative-path
changes or a synchronous callback, then sends the entire prepared value in an
ETag-conditional replacement. Supplied child objects replace their previous value;
there is no special Local collection merge. Both providers require the explicit
backend, and Firebase update no longer constructs a fallback client. Firebase paths
are normalized to strings; Local named paths remain intact. Object updates now
require read and write permission, just like callback updates. Object/Map batches
remain one root-relative atomic patch of full replacement values for each address.
ETag conflicts rerun preparation up to 25 times with bounded jittered backoff.
Null callback results delete; undefined leaves storage unchanged without a replacement request.
Callbacks receive copies. No-change callbacks return the original snapshot (null when absent);
replacement callbacks return the confirmed backend value.
The protocol keeps Security Rules authoritative and never serializes callbacks.

DatabaseBase.delete validates the prepared path and sends database.delete through
its injected backend. Providers prepare the path and call super.delete: Firebase
resolves a string address, while Local retains its validated named path. Their
single operation boundary preserves the original error context and options.onError.
Both providers require a supplied backend; delete never creates a fallback client.

Firebase `database.delete` uses this shared backend routing.
Its single path argument is the direct callable payload, and `database-delete`
performs an unconditional Rules-authorized REST DELETE with the caller's ID token.
It needs write permission only, supports root and absent paths, and returns null
to the transport while the database adapter resolves to undefined.

TypeScript migration is incremental. Babel strips TS/TSX types; existing JS and
extensionless imports remain supported. Source contracts do not imply mandatory
type checking or published declarations. Public `.d.ts` generation is currently
absent. Keep type-only dependencies from becoming runtime imports.

### Consumer bundling and dependency constraints

Web consumers resolve the ESM entry and deduplicate shared peers from the
application root. Local linking must share React and i18next instances: duplicate
instances break hooks/context even when installation and compilation succeed.
Keep Rollup CommonJS `interop: 'auto'`. Normalize a legacy package's default
export only where required; linked CommonJS namespaces have previously produced
invalid React elements. Verify rendering, not just importability.

Dual-format output also prevents CRA from treating a transitive `.cjs` dependency
as an asset URL, as happened with date-fns through react-datepicker. Packaging
changes must preserve both entry formats and be checked in both web consumers.

React source files retain `.js` extensions, including JSX. Consumer Vite configs
transform application JSX before ordinary processing and enable JSX in dependency
optimization. Framework/server Rollup packaging remains a separate concern.

PWA builds retain the classic service worker through `injectManifest`. Redequate
owns the update prompt and `SKIP_WAITING`; do not introduce generated replacement
workers, automatic update activation, or duplicate registration. Preserve hosting
paths, root URLs, Firebase messaging workers, and the application's version source.
Legacy `PUBLIC_URL`/`REACT_APP_VERSION` definitions are compatibility inputs.

Babel 8, ESLint 10, TypeScript 7, Router major upgrades, and replacement of legacy
widgets remain separate compatibility work. Avoid broad dependency migrations
while correcting an individual runtime issue.

### UI and lifecycle decisions

Redequate-owned controls form the UI-library boundary. Use CSS Modules and the
selector ownership rules in AGENTS.md; keep Material icon imports/usage through
`@mui/icons-material`. Component conversions must preserve interaction contracts,
including which element owns ripple feedback.

Themes are mounted CSS through the existing Theme components and CSS variables.
Do not restore a public MUI theme object or external component `classes` overrides.
See [Usage](README.md#usage) for stylesheet and consumer integration.

Uppy performs local file preparation; Storage owns upload. Do not restore unused
transport plugins merely to obtain progress UI. Preserve the upload input/result
contract and existing cleanup behavior when replacing a widget.

One Tap shares script loading, initializes per active mount, and cancels prompts
and timers on cleanup. FedCM display-moment callbacks are not a reliable lifecycle
signal. Disabled/unconfigured prompts must not leave the invitation flow pending.

Known legacy constraints include React 19 peer exclusions and the Lightbox
`global.window` incompatibility under Vite. Do not hide these with an unrelated
global shim or infer support from a dependency version change. Migration evidence
is historical in [MIGRATION_VERIFICATION.md](MIGRATION_VERIFICATION.md).

## 4. Service boundaries and models

### Provider construction and common code

Applications construct stable provider instances and pass them to Dispatcher.
Resolvers preserve supplied instances and lazily construct Local defaults when
omitted. Dispatcher resolves Database before Auth and supplies it to the default
Auth constructor. Custom model selection belongs in the Auth constructor, not
post-construction mutation of provider internals.

Built-in providers expose their classes as default exports. Base classes provide
shared contracts/validation; SDK references, credentials, tasks, and snapshots
stay inside implementations. Extend contracts for actual application scenarios,
not by mirroring an SDK or adding speculative operations.

`packages/common` is runtime-neutral shared source. Its UserData class owns model
state, serialization, role policies, and formatting without React, Firebase, browser
controllers, or module-level model instances. The web UserData subclass adds
persistence/cache behavior and keeps its database/bookkeeping in private fields.
Use `new UserData`; the former callable/extend API is removed.

Timestamp sentinels belong to database providers. Common UserData formats resolved
numeric dates and must not recognize Firebase `.sv` shapes. The web model handles
its injected database's `TIMESTAMP` marker before delegating ordinary formatting.
Do not restore the removed shared `SERVER_TIMESTAMP` export.

### Authentication and profiles

Auth operations return detached UserData models rather than SDK user/credential
objects; signed-out restoration/subscriptions use anonymous models.
`resolveCurrentUser` owns session restoration. There is no separate cached-current
user getter or public Auth JSON parser/token-retrieval API. Provider errors retain
their codes, and subscription registration returns a promise of an unsubscribe.

AuthBase owns constructor/model configuration, shared argument validation, and
profile persistence using UserData role policies. Provider operations call
validation supermethods before side effects. These supermethods validate synchronously; provider operations
implement the asynchronous work. Registration, profile updates, and verification
require an injected database; saving must not silently disappear when it is absent.

Profile writes use the established `users_public`, `roles`, and `users_private`
paths in a database batch. Omitted sections remain unchanged. Initial null roles
and empty private sections are not writes, so ordinary Firebase signup does not
require permission to modify protected roles. Auth secrets remain provider-owned.

LocalAuth persists namespaced accounts, session, links, and simulated mail in
IndexedDB, separately from LocalDatabase. Writes notify observers only after
success. Revision checks and conditional rollback protect the existing state
transition; failed profile creation restores the previous auth state. Legacy
localStorage auth data is not automatically migrated or deleted.

AuthBase initializes missing profiles before returning or notifying an authenticated
model, including session restoration and redirect. Login does not initialize profiles.
Login treats a profile already persisted by AuthBase as an ordinary existing
profile: no first-login transformation, onLogin(false), and home navigation.
If no public profiles exist (checked with a one-entry cursor), it attempts to save
ADMIN with the initial profile in one batch. This applies to every Auth/Database
combination and does not depend on retained LocalAuth accounts. Database permissions
remain authoritative: permission denial during the emptiness check or ADMIN write
logs a console warning and falls back to an ordinary profile; other failures
propagate. Existing profiles are not overwritten. Database implementations contain no role policy.

Local registration is sequential by requirement. Do not add registration queues,
Web Locks, or guarantees for concurrent registrations. Failed profile persistence
must not leave an installed Local account/session behind. UserData guards demotion,
disabling, and deletion of the last administrator with an existing public profile.
Check ADMIN-filtered roles, then individual candidate profiles; do not load all
profiles. This client check does not establish atomic bootstrap ownership across
concurrent clients; retain existing database security rules.

### Provider storage configuration

Provider options/properties use storageId; the common default is LOCAL_DATABASE_NAME
(`redequate:local`). Missing or undefined selects the default; explicit invalid IDs
reject. The ID names the physical IndexedDB shared by local Database/Auth/Storage/
Messaging. Service stores are `$auth` (typed records, unique account email, atomic
revision checks), `$storage` (fullPath key, unique URL), and `$messaging` (token key).
All store names beginning with `$` are reserved for providers and excluded from
application collections/schema changes. Database recognizes that prefix without
knowing individual providers or their legacy store names. Existing modules
retain their locations. Each provider owns its local/stores.json: Auth, Messaging
and Storage pass their schema to common/openLocalDatabase only on storage access.
Common knows no provider schemas and imports no database/local modules. Without a
schema it opens the database without creating stores. Database keeps its existing
local/stores.json format and application collection/index/row-migration logic;
it neither creates nor alters other providers' stores. Initialization order and
concurrent schema additions must preserve all existing stores. There is no automatic migration or deletion.

LocalMessaging token persistence uses IndexedDB; FirebaseMessaging keeps localStorage
with key `<storageId>:notification-token`. Its saved token is removed only after SDK
success. Non-provider framework keys and SDK internals are outside this change.
Backend methods, dependencies and CRUD routing remain unchanged.

### Storage and messaging

Storage exposes upload, URL/metadata resolution, and deletion. Upload receives
Auth plus a Blob/File and returns `{url, metadata}`; progress is a percentage
string. Providers own naming and SDK conversion; image processing, replacement
cleanup, and upload UI remain caller responsibilities.

Local Storage persists files/metadata in IndexedDB and returns data URLs with
unique fragments. This is an explicit browser simulation: URLs duplicate data,
remain usable after record deletion, and do not provide access-control semantics.
Keep namespace isolation and commit-before-resolution; do not add a memory fallback.

Messaging has four async operations: `checkIfSubscribed`, `subscribe`,
`unsubscribe`, and `addMessageListener`. Registration returns a disposer;
subscription and listener attachment are separate actions. The fast subscription
check reads the persisted token without prompts or SDK work. For Firebase, save
it only after successful acquisition and remove it only after successful deletion.
A saved token expresses application subscription choice, not server validity.

Dispatcher attaches foreground receiving only for subscribed clients, retaining
its iOS guard and Android bridge fallback. Token persistence in profiles,
notification UI, and background workers remain application responsibilities.
Do not change native subscribe/unsubscribe bridge names or existing token formats.

Local Messaging uses a persisted UUID token and same-origin `postMessage` envelopes
shared with Local Backend notification delivery. Validate origin, source, namespace,
and subscription; give each listener its own message copy. Unsubscribed/absent
listeners drop messages without a queue. This is foreground simulation, not push
or a system notification service. The console sender is a Local-only helper.

### Backend and Functions

Backend exposes `request(name, ...args)` and returns application payloads. The Firebase
client unwraps the callable SDK envelope once. `useBackend` from the framework
root and backend subpath shares the same Dispatcher context within a module format.
Do not leak SDK result wrappers into UI or change existing callable response shapes.
Firebase request names use dotted logical operations (for example, `database.create`).
The Firebase client maps every dot to a hyphen for the deployed endpoint, keeping
the original name available for future audit metadata. Existing endpoint names
without dots remain valid; callers do not perform transport-specific mapping.
Multiple positional arguments travel as an array; a single argument keeps its
existing payload shape for legacy callables. `database.create` accepts exactly
`(path, value)` through a two-element array and rejects the old object envelope.

LocalBackend from `redequate/backend/local` accepts `{storageId}` and owns no
LocalDatabase instance. Its create/update/delete handlers open IndexedDB by storageId and write
only to prepared application stores. Missing stores fail; schema initialization
remains separate, and collection notifications are published after commit. resolveBackend
caches one default instance; explicit backends remain as supplied.
Atomic numeric changes use backend.increment(n). BackendBase declares the
contract only; FirebaseBackendClient delegates marker construction to the Firebase
database SDK, while LocalBackend owns its finite-number validation and factory.
Firebase produces the JSON-compatible {".sv": {increment: n}} wire format.
Local returns a fresh object whose finite delta is stored under a private, module-scoped
Symbol key. No global registry retains markers. The marker stays within the local
request path in one JS space; a clone loses its Symbol key. Reusing one marker applies
its delta again.
Database providers have no increment method. Local resolves markers against the
stored value inside the write transaction, including nested record/batch values.
Local direct database.update requests with an increment marker return the saved
number. FirebaseBackendClient wraps ordinary nonempty-path writes as root PATCH
batches, without inspecting values or increment markers, and returns null. Root
batches and explicit patch/read/conditional replace modes pass through unchanged.
The Firebase Functions update handler retains its existing PATCH/GET/CAS PUT contract.
Callable requests never transport executable callbacks. Counter callbacks run in
common/handlers/utils using the existing Database update read/conditional replace
loop, which retries conflicts against the returned snapshot. Local commits the
replacement in one readwrite transaction and publishes after commit. Admin uses
its native SDK transaction inside database.update's conditional replacement.
Conditional replacement holds a temporary value subscription through completion
to populate the SDK cache before comparing tokens, and removes it in finally.
A one-shot get alone does not retain the cache and can cause false conflicts.
There is no separate database.transaction command.
The helper common/handlers/utils.updateCounter(backend, counterPath, increment)
accepts a nonempty array path relative to _counters and adds that collection itself.
String paths are not accepted. It applies
the legacy counter rules atomically: missing/nonpositive counters reset to a
positive step or delete; a positive counter deletes when the sum is nonpositive.
Only ordinary named Local counter paths are unambiguous for its declared indexes.
TIMESTAMP markers belong to BackendBase's provider contract. LocalBackend owns a
stable frozen timestamp object with a private module-scoped Symbol key and
recognizes it during native writes. Like Local increment, the marker is valid only
in the local JS context; JSON and structured clones lose its Symbol key. Ordinary
Firebase-shaped timestamp objects have no special Local meaning;
Firebase client and server backends use their respective SDK timestamp values.
DatabaseBase retains the single compatibility getter delegating to its injected
backend, so models and components can keep using database.TIMESTAMP. Database
providers no longer create or re-export timestamp markers.
LocalBackend and FirebaseServerBackend provide internal database.read(path),
returning null for missing values and preserving falsy values. Local directly uses readStore in a readonly transaction without an ETag;
the server uses Admin SDK get(). Firebase client reading
remains unchanged.
ExtraListener creation/deletion uses utils.updateCounter with relative paths and
steps +1/-1; missing deleted extras are ignored. onCreate then reads the
post author's uid. For an existing different author it creates alerts/{uid}/{key}
with the original alert.create payload and backend.TIMESTAMP; missing authors and
self-reactions create no alert. Deletion only updates its counter and preserves
existing alerts; onUpdate and application Functions registrations are unchanged.
FirebaseServerBackend extends backend/common/BackendBase and dispatches internal
create/update/delete operations to firebase-server/src/database/admin. These use
Admin SDK privileges; external callable REST handlers live in the adjacent
database/callable directory and retain caller-token authorization. Both groups
keep separate entry points; exported Functions names remain unchanged.
Admin create uses an absence-only transaction and returns its explicit or push key;
conflicts use database/conflict. Admin update replaces one value with set(), or
applies root object/normalized Map batches with update(); delete uses remove().
Both write operations return null and propagate SDK errors.
Local onWrite subscriptions use provider-neutral definitions from backend/common/handlers.
Backend listener array paths use the first segment as the collection and every
subsequent bare string as a captured field. For example ["alerts", "user_id",
"alert_id"] means all alerts of all users; fixed objects constrain values and
{field: "text"} selects a literal nested field. Shared database/common/parsePath
also recognizes explicit {user_id: "{owner}"} aliases. Firebase compiles captures
into its native wildcard ref. Local uses declared index fields (or _id), captures
identities from physical rows before decoding, and compares matches by full
concrete path. Unindexed captures and nonunique matches are rejected. Both
providers include captured and fixed named parameters.
This grammar belongs only to backend listeners; Database reads, cursors, UI
subscriptions and CRUD paths retain their existing rules. No schema migration is needed.
Readwrite transactions capture logical before/after snapshots for subscribed paths and
publish source-tagged changes only after commit and connection close. Their source
context delivers backend reactions once; other tabs still receive collection-only UI
notifications. Callback promises are observed but never awaited by delivery, allowing
reactions to await further backend writes without deadlock. A request confirms its
write, not completion of the reaction chain. Unchanged values and rollbacks emit no
backend event. Shared handler definitions are exported by backend/common; browser
packaging rejects all common-server and firebase-server modules.

Native transaction, index-query and write primitives live in one adjacent
createHelpers module. Database/local retains schema initialization, native reads and listener delivery. Cursor handler replacements use common/methods/update with the supplied backend, matching Firebase; database performs no direct record writes. The adjacent recordValue module encapsulates encoding and restoring Local record values without duplicating object payloads. Common/localDatabase.js is unchanged;
there is no additional common storage layer or context registry.

LocalDatabase receives backend explicitly; it never constructs or resolves a
replacement. create prepares its final key, synchronous callback and record before
request("database.create", preparedPath, preparedValue). The backend accepts only a
record object and returns the committed key or throws. The create method retains only preparation, delegation and its error boundary.
It performs no schema preparation, collection checks, IndexedDB access or mutate
notifications; backend stores must already be prepared separately.
Dispatcher resolves backend before database, passing it through resolveDatabase.

New automatic Local IDs use firebase-key.key() for both object and callback values;
backend requests without a supplied key use the same generator. IDs sort by generation
time, monotonically within one generator despite same-millisecond calls/clock rollback.
They are not commit timestamps or a globally synchronized order. Existing/explicit keys
and numeric physical _id remain unchanged. The numerical logical-key allocator is removed.
Callbacks run before storage requests, including requests that later conflict; failed
saves roll back records, while generated logical IDs are not reserved or reused.

The former local-server worker and its package export/build have been removed.
IndexedDB is already asynchronous; a separate worker added a message protocol,
configuration transfer and marker encoding without a current CPU-bound task.
Heavy computation may justify a worker later; backend requests currently require
no worker lifecycle, readiness protocol or serialization.

Functions common/database imports come from the server archive without browser
initialization. Preserve deployed RTDB paths, trigger scope, callable envelopes,
and Android compatibility when modernizing SDKs or Gen2 deployment configuration.
Use the injected Firebase database facade; importing a package must not initialize
an SDK. Detailed server packaging belongs in its README.

### Firebase Web SDK

Firebase Web initialization and the Firebase Database provider use the modular SDK;
do not restore `firebase/compat` imports or namespaced database calls. The shared
Firebase handle retains `app` and `config`; providers receive that handle.
One-shot RTDB snapshots use `onValue` with `onlyOnce: true` to retain the previous
cache/event behavior. Subscriptions retain their own SDK unsubscribe functions.
Android wrapper resume reconnects `getDatabase(firebase.app)` through modular
`goOffline`/`goOnline`; refresh deletes and reinitializes the app before reloading.

## 5. Database and cursor architecture

The behavioral source of truth is the existing
[Database/Cursor contract](packages/database/src/common/CONTRACT.md), backed by
shared Local and real-emulator scenarios. Public source types live in
`packages/database/src/common/DatabaseTypes.ts`. Keep this section focused on
choices that are easy to accidentally reverse.

### Address and operation semantics

Paths accept strings or arrays with string/named segments. A named segment has
exactly one string-valued field; the old _ metadata is removed. The shared
parsePath normalizes paths and describes segments as {name, value, parameter?};
unbound array fields and explicit wildcard aliases use its PATH_VARIABLE Symbol.
The original serializable path is retained: markers never travel in backend
requests or BroadcastChannel messages. Operation-specific create/read/listener
rules remain at the call sites; resolvePath keeps concrete address semantics.
There are no separate parseCreatePath, parseReadPath or parseListenerPath modules.
Provider adaptation is implemented by SDK-independent module functions in
Database/local/parsePath.ts and Database/firebase/parsePath.ts, used by both
Database and Backend. They take address (default), collection, create or listener
mode. Address mode preserves concrete native backend reads and writes; collection
mode selects the final bare key field for Database reads, cursors and UI listeners.
Create mode supplies parent/key information. Listener mode produces Local index
captures or Firebase wildcard refs and fixed params. No parser method is installed
on provider classes. Local store-only validation is also exported from its adapter
for the update/delete superclass pipeline, where generic validation already runs.
resolveParsedPath renders an already parsed result without validating it again.
 Named segment values
form the Firebase address; Local also uses their names to select record fields. Shared validation/normalization must not mutate caller input.
The first Local segment selects a configured physical store, not a virtual collection.

A trailing string in a Database array read/cursor/UI-listener path of at least two segments names an
identity field. It is not a literal final branch:

- `["users_public", "user_id"]` reads the user collection.
- `["users_public", {user_id: uid}]` selects a user and its subtree.
- `["users_public", {user_id: uid}, {email: "email"}]` reads a concrete field.
- String paths remain literal; a single-root array selects its collection.

This operation-specific rule does not redefine create/update/delete or
`orderBy` grammar. Preserve `PostData.fetchExtras` targeting the extra collection
with its identity marker; querying a literal `extra/extra_id` branch loses the
consumer's existing `id_uid` index. Root reads reject; root cursors are valid.

Create allocates/writes an absent record and returns its permanent string key.
A synchronous callback can compute the value from that final key. Duplicate keys
fail atomically. Firebase uses a transaction and needs read plus write permission;
Local allocation and insertion share a native IndexedDB transaction.

Object update is a shallow merge, retaining unspecified fields and deleting null
fields. Callback update atomically replaces/returns the whole value; null deletes,
undefined leaves the original value unchanged without a write. Mutations to the callback's
copy are discarded unless it returns a value, matching cursor.handle. Firebase and Local may retry the callback, so it must be synchronous and
free of external side effects. Batch paths are root relative; callbacks belong
only to the single-path overload. Delete is idempotent; public `write` is removed.

Reads return plain values or undefined for absence, without an iteration-order
guarantee. Use cursors for ordering. Query options select immediate children;
`equalTo` excludes start/end, and explicit value ordering differs from key ordering.
Neither provider invents a timestamp field or changes the caller's value shape.

DatabaseBase centralizes synchronous `onError(error, reason, context)` policy.
The operation override wins over the database default, which throws the original
error. A normally returning handler suppresses failure and yields undefined;
its return value is ignored. Handler exceptions propagate once. Cursors/listeners
retain the effective policy, including deferred callbacks and cleanup failures.

### Cursor ownership and subscriptions

DatabaseCursor is a runtime class shared by root/database exports of `redequate`
within each format; `redequate-server` exposes it only through `/database`.
Custom cursors must extend that constructor and call base methods;
structural lookalikes are unsupported. Do not mix constructors from separate
installations or ESM/CommonJS formats: their `instanceof` identities differ.

Cursors own a stable id, path, count, and readonly `{index, key, finished}` position.
Traversal is sequential through `next(n)`; restarting requires a new cursor.
Records are `{key, value}`; synthetic group headings are `{key}` without value.
Headings appear once, count as returned entries, and do not consume data page size
or invoke handle. Detailed group inheritance belongs in the behavioral contract.

Handle runs sequentially on copies. Undefined keeps the original read value and
storage; null deletes; another result replaces and is reread for resolved values.
A failed page does not roll back completed actions. Keep scanned continuation
state separate from the last returned entry: filtering and writes can move/delete it.

Provider cursor factories return compositions, including a single path. Fresh
source cursors are exclusively owned by the composition. Deduplicate by normalized
leaf path plus key, falling back to cursor id plus key when no path exists.
Separate queries over the same collection must still suppress overlapping records.
Composition does not globally sort sources or rerun their handlers.

Firebase continuation uses inclusive boundaries and retains buffered extra rows;
exclusive SDK boundaries previously caused premature exhaustion. Preserve that
workaround when changing pagination. Date bounds use Firebase key time but Local
explicit timestamp fields. No cross-page transaction or exact concurrent snapshot
is promised; a moved record can be handled before composition deduplication.

Subscriptions report add/change/remove without replaying their initial contents.
Handles are independent; removal is idempotent and cleanup attempts all sources.
Count includes returned entries and delivered adds minus removes. Standalone
`onChildAdd` uses the initial maximum key as its strict addition boundary.
Do not replace that with initial replay or a bounded listener that can miss events.

### Local storage and schema

Application stores and their indexes come exclusively from local/stores.json and
constructor stores. There are no generated identity, path, type or cursor indexes.
Object records store actual fields directly, with native _id and address fields.
Do not add _record, _encoded, _local, restoration lists, shadow values or duplicate
payloads. Reading excludes _id and all fields of unique indexes, including explicitly
supplied keys; exact recovery of those keys as user data is no longer supported.
Stores without unique indexes exclude fields explicitly selected in the address or
as the collection key. Ordinary non-unique indexed data such as posts.uid and posts.to
remain visible. Empty branches left by nested service keys are pruned; incompatible
indexed parents reject rather than being overwritten.
Strings, numbers, booleans and arrays use _value as their single payload, without a
type marker. _value is reserved at the record root; _record and _encoded are reserved
legacy service fields. Nested fields with these names are ordinary data. Old wrappers
reject with VersionError; never migrate or delete them automatically.

Lookups use declared simple/compound indexes, including compound-prefix scopes, or
native primary keys. Missing lookup indexes and ambiguous addresses reject explicitly.
Native unique indexes enforce uniqueness. Record updates retain their native primary
keys; multi-store batches are atomic and reject overlapping addresses.

Stores without secondary indexes intentionally hold one small document. Field access
reads/updates that document; these stores do not support search or query options.
Do not add indexes or record registries to them. Provider stores beginning with $
remain isolated from application CRUD and schema updates.

Schema preparation remains available through read/listener/cursor paths and explicit applySchema. Local-only applySchema changes
declared indexes/stores without rewriting data, migrating old formats or deleting
unrelated indexes. Create and update prepare their values and delegate to the explicit
backend; delete forwards its validated path through request("database.delete", path).
All three operations require prepared stores. Observers refresh ordinary collection
snapshots after committed writes; broadcasts carry collection names only.

The old encoded record format is unsupported. No migration script, startup/Dispatcher
migration or compatibility decoder is shipped or run. Tests use fresh disposable
IndexedDB factories; developer data is not deleted or converted.

## 6. State, navigation, and retained constraints

### Immutable models and SSR boundary

New state uses internal GlobalStore/UseAbstract/AppState through AppContext and
`useSyncExternalStore`; existing Redux slices migrate incrementally. Different
keys own independent stores. Object.is suppresses unchanged references, so edits
require a replacement model rather than mutation followed by assigning it again.

Stores normalize and deeply freeze snapshots in production as well as development,
preserving object identity/prototypes. Descriptor traversal must not invoke getters
or freeze shared service dependencies. Reject mutable built-ins whose internal
slots survive Object.freeze, including values from other realms. Model authors
keep services/bookkeeping in private fields and observable data in own fields.

The current-user hook stores the actual web UserData instance with its methods.
It starts with an anonymous model and normalizes null/undefined to a new anonymous
model. Do not restore the removed current-user Redux cache, accessor bridge, or
snapshot wrapper. Auth restoration identifies the user; enrich the same session's
profile before publishing it. Logout clears it only after successful sign-out.

Prepare login notification data and profile saves before publishing the model:
publication freezes its public data. Later changes require replacement models.
Notification failures retain the existing nonfatal behavior; disabled users follow
the existing profile redirect without subscription. UserData.toJSON provides a
detached export for reconstruction/editing; store writes do not clone models.

Request-local state support does not mean application SSR is complete. Create
AppState after server preload and supply it explicitly for server imperative access.
Global browser state must not serve server requests. Hydration uses the same
prepared initial snapshot; serialization/model reconstruction belongs to the app.
Do not use `set` as server preload or add automatic class serialization.

Provider state/initialState is selected once per mount. Fork/reset preserve the
prepared immutable baseline; registration keys are unique. Registry HMR requires
a full reload, not implicit duplicate-key reuse. State audit rationale is retained
in [STATE_AUDIT.md](STATE_AUDIT.md).

### Lists and publication navigation

LazyList retains the cursor prop and defaults to `live=false`. Owners create fresh
cursors during render; cursor replacement invalidates the previous loading session.
Do not add revision counters, list caches, or automatic refresh actions in mount/
filter effects. Loaded rows are not retained across unmounts. Explicit
`Layout.REFRESH` remounts the routed tree; visibility `REFRESH_CONTENT` does not.

Rearm the observer after each completed page, including pages whose transformations
all return null. Enrichment can read independent counters/extras/author data in
parallel, but failures must settle rather than leave pagination pending indefinitely.
Live subscriptions remain opt-in; page work and notifications are not serialized
through a component-level operation queue.

Root publications use numeric `to: 0`; replies use their parent ID. A null marker
is removed by RTDB and cannot satisfy Discover's equality query. After publishing,
commit the composer's close with flushSync before calling onComplete: otherwise
ModalComponent's history blocker can cancel Home's immediate post navigation.
Returning to Discover then creates a fresh cursor without enabling live updates.

This shared correction was verified in both Firebase and Local browser flows.
The historical provider-specific refresh difference was not reproduced or proven.
No writer for `discover/{uid}` was identified in the checked-out Functions code;
do not invent a Local discover store or infer a remote writer from a listener.
Temporary tracing has been removed. Captured evidence is archived in
[the Discover report](DISCOVER-REFRESH-DIAGNOSIS.md).

### Consumer repair compatibility

Post transformations using missing-post repair require the consumer's Backend.
Legacy replies can contribute to counters without migration/deletion; repair must
finish reading its inputs before writing baselines. Tag repair must preserve links
that changed after its initial snapshot rather than replacing an entire feed.

Mutual repair retains directional relationship and request semantics: friendship
requires approval, following does not. Baseline repairs must not pre-apply deltas
that existing triggers will add. Atomic snapshots across repairs/triggers or
concurrent text edits are not guaranteed; keep that limitation explicit instead
of adding an unrelated concurrency protocol.

Roles remain scalar strings for all database callers. Local uses its general record-value codec; auth and UI do not handle Local storage formats. Value queries operate on decoded values without new service indexes. No existing browser data is migrated.

LocalDatabase.update delegates all saving to LocalBackend database.update, without
opening IndexedDB, preparing schema, or emitting notifications. It merges object
changes in Database (shallow or relative-path updates, replacing supplied child objects),
or executes a synchronous callback to prepare a full replacement. ETag conflicts
rerun preparation up to 25 times with the same retry policy as Firebase. Batch values
are full replacements sent in one root Map. Delete and cursor write paths are unchanged. It accepts `(path, changes, options?)` with
patch/read/replace modes. Patch expands child paths and root-relative object/Map
batches into a single native transaction. Read returns a logical snapshot and a
canonical, type-sensitive string ETag without stored revisions. Replace compares
that token and writes inside one readwrite transaction; a mismatch returns the
current snapshot without writing. Both read and conflict responses contain only
the logical value and ETag (plus committed:false for conflicts).
The backend never executes update callbacks.
Empty paths are only supported for batch patches. Prepared stores, the existing
record codec, overlap validation, and post-commit collection notifications are reused.
No automatic schema initialization, migration or Firebase changes are added.

LocalDatabase.update and FirebaseDatabase.update perform provider-specific path
preparation and batch encoding, then explicitly call super.update. Local retains
named paths in a Map; Firebase normalizes paths to strings and builds an object.
A single this.run boundary in each provider covers preparation and the superclass
call, preserving original error context and invoking onError only once. As with
create, DatabaseBase.update validates prepared arguments and uses its injected
_backend without another error boundary. Single updates call common/methods/update
for full-value preparation and ETag retries. There are no path/batch hook methods.
Provider-specific update logic lives in firebase/update.js and local/update.js,
including path/batch preparation and the error boundary. Both classes only delegate
arguments and bound run and super.update functions. Firebase cursor replacements use the same common single-update helper with
the explicitly passed backend.

### Alert push delivery

AlertListener sends the original alert data payload when an alerts record is created;
updates and deletions do not send notifications. Author lookup failures use Somebody.
BackendBase exposes projectTitle (default Redequate) and projectUrl. LocalBackend accepts
both in its existing options object and defaults the URL to the current origin.
FirebaseServerBackend accepts a third options argument with projectTitle/projectUrl
and an optional getMessagingInstance factory; its default URL is the database app's
Firebase Hosting origin. Existing constructor arguments remain compatible.

The internal notification.send request takes tokens, payload, and optional options.
AlertListener calls this request directly. Firebase internal delivery and the
admin-only callable share the named sendToTokens export from notification/send.js, including emulator simulation and batches of
500. Local delivery posts only for the current subscription token in the same storageId;
it remains foreground simulation. Push payload fields and alert records remain compatible
with web and Android consumers. No new callable endpoint is exposed.
