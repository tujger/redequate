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
sources, and Node server builds reject browser and UI sources. LocalBackendClient
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

Firebase `database.update` routes all writes through the same Backend as create.
Its ordinary `(path, changes)` request performs a Rules-authorized REST PATCH;
object/Map batches become one root-relative PATCH. Callback updates execute on the
client, using `(path, null, {mode: "read"})` to obtain `{value, etag}` and
`(path, value, {mode: "replace", etag})` for a conditional PUT. Responses report
`{committed: true, value}` or `{committed: false, value, etag}` on conflicts.
Callbacks may rerun against current data, with up to 25 write attempts and bounded
jittered backoff. Undefined callback results delete; confirmed server values are
returned. The protocol preserves Security Rules and requires read/write access
for callbacks; it never serializes functions or bypasses Rules through Admin writes.

Firebase `database.delete` follows the same injected/default Backend routing.
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

LocalDatabase and LocalBackendClient use `storageId`, defaulting to `redequate:local`.
The former LocalDatabase `storageKey` option/property is removed without an alias.
LocalBackendClient creates its own LocalDatabase for that ID; it receives no database
instance. Dispatcher supplies the resolved database's storageId to resolveBackend;
automatic backends are cached by normalized storageId. Explicit backends remain as
supplied. Applications pass one storageId to both constructors. Auth, Storage and
Messaging retain their separate storageKey settings.

The IndexedDB `redequate:local:` name prefix and change-channel format are preserved.
The default ID change selects a new physical database; no automatic data migration
is performed. Explicit `storageId: "redequate:database:local"` opens the former default.
Schemas remain instance-scoped; the internal backend database uses default stores.
`request("database.create", path, value)` delegates to LocalDatabase.create and
returns its permanent string key, preserving callbacks and timestamp/increment
markers. Unsupported operations reject with `backend/not-implemented`.

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

Paths accept strings or arrays with string/named segments. Named segment values
form the Firebase address; Local also uses their names and optional dynamic level
as identity metadata. Shared validation/normalization must not mutate caller input.
The first Local segment selects a configured physical store, not a virtual collection.

A trailing string in an array read/cursor/listener path of at least two segments names an
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
fields. Callback update atomically replaces/returns the whole value; null or
undefined deletes. Firebase may retry the callback, so it must be synchronous and
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

`local/stores.json` plus constructor `stores` are the only native store/index
configuration. Identical definitions merge; conflicting definitions reject.
Additional configured stores participate in CRUD, nested paths, cursors, and
subscriptions. Collection visibility is instance-scoped even when storageId is
shared. Do not restore parallel store registries or field whitelists.

Physical rows use native auto-increment `_id`; the generated public key is a numeric
string allocated during create. Each store has one unique `_identity` index on
`_local.path`; other native indexes come only from configured definitions.
Do not restore allocator stores or generated cursor/scope/type indexes.

Public object fields are stored once, alongside sparse `_local` address/identity
metadata. Scalars/arrays and overwritten reserved fields retain their original
values through that envelope. Internal primary keys and metadata must not leak
into public reads or overwrite caller data. Nested JSON alone does not establish
a new collection; named/existing identities determine record boundaries.

Cursor/type queries scan collections with the shared comparator; native paging
is not guaranteed. Do not claim generated-index performance from superseded
implementations. Large collections can be slower, and indexes must preserve
actual public-field and nested identity semantics.

Preparation is lazy per instance. Compatible schema/envelope upgrades are atomic,
preserve `_id` and records, and do not bump versions when unchanged. Constraint
failures roll back rows, indexes, and version. Blocked upgrades remain retryable.
Older incompatible `_rowId` databases require explicit repair/reset on the chosen
origin; opening must never silently delete them.

`applySchema` belongs only to LocalDatabase and accepts its physical-schema format;
it does not register additional CRUD collections. It is additive: unspecified
stores/indexes remain, and keyPath/autoIncrement changes or record deletion are
not an implicit migration. Auth uses separate IndexedDB storage.

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
