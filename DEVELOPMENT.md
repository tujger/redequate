# Redequate development decisions

Persistent architectural memory, not a changelog or test report. Executable commands
are in [README.md](README.md); repository rules are in [AGENTS.md](AGENTS.md).
Public database behavior is specified in the
[Database/Cursor contract](packages/database/src/common/CONTRACT.md).

## Ecosystem and scope

The validation chain is Redequate → demo → The Whisky Talks. Changes to URLs,
authentication, APIs or data formats also require consideration of the Android
consumer. Develop on the appropriate story/bugfix branch; master is not assumed
to be the current development state. Architectural decisions spanning consumers
belong here rather than in repeated app notes.

CSS Modules/UI isolation is completed; React 19 stabilization remains the current
framework milestone. Vite exists in the web consumers, while library packaging
remains Rollup. Keep React, build-system and rendering changes separately reviewable.
Request-local state support does not establish full application SSR. SSR and later
business/demo milestones require a separate task. Peer overrides and successful
builds do not establish upstream React compatibility or release readiness.

## Packaging and UI boundary

- Public exports come from package.json. Web root ESM uses core/index.es.js;
  package services use .mjs/.cjs. Do not change the package type to accommodate
  one dependency or mix constructor identities from different formats/installations.
- Runtime modules live under packages/*/src. Build helpers declare entrypoints and
  source ownership; Rollup assembles them. TypeScript conversion is incremental:
  Babel strips types, and source types do not imply published declarations.
- Browser packages must not pull Node server/UI-incompatible modules across the
  boundary. Functions install redequate-server, whose common/database/backend
  exports and runtime dependencies are independently packaged. There is no server
  root export. LocalBackend belongs to the browser package.
- Consumer React/react-dom/i18next/react-i18next must resolve to the canonical
  linked framework copies with matching versions. The link helper does not replace
  canonical packages when another consumer starts. Do not add incidental consumer
  aliases or global shims to disguise dependency or interop failures.
- Controls own their CSS Module selectors. Preserve Material icon usage and
  interaction contracts, including ripple ownership, under AGENTS rules. Themes
  mount CSS and custom properties; consumers own any MUI ThemeProvider.
- Uppy prepares files; Storage owns upload/progress. Do not restore unused transport
  plugins to supply UI. Shared One Tap loading must clean up per-mount prompts and
  timers; FedCM display callbacks alone are not reliable lifecycle completion.

## Provider wiring and authentication

Providers are stable objects selected once per Dispatcher mount. Dispatcher wires
resolved database/backend/auth dependencies through setter methods. Standalone
consumers and tests must do this themselves; obsolete constructor injection is not
an alternative. Custom structural providers need not inherit a registry base.
Changing implementation requires remounting; repeated render must not construct
new SDK/provider instances.

AuthBase owns model construction, shared validation and profile persistence.
Providers await validation before effects. Auth returns detached UserData rather
than SDK credentials; signed-out restoration yields an anonymous model. Subscription
registration returns a Promise of a synchronous unsubscribe function. Provider
errors retain their codes. No public token/parser API is added to UserData.

Profile writes use users_public, roles and users_private in a database batch.
Omitted fields remain unchanged; null roles/empty private state need no signup
write. Credentials stay with Auth; profile roles remain governed by Rules.
Registration, verification and profile updates require a linked database. AuthBase
initializes missing profiles before returning/notifying an authenticated model;
Login treats persisted profiles as existing, without repeating first-login setup.

The first-profile check attempts an initial ADMIN write; permission denial falls
back to an ordinary profile with a warning, while unrelated errors propagate.
This is not an atomic cross-client bootstrap claim. Local registration remains
sequential by requirement: do not add registration queues/Web Locks as a side task.
A failed profile save must not leave an installed Local account/session. Guards for
demotion/disabling/deleting the last administrator inspect eligible role/profile
records, not all profiles. Preserve server authorization; client guards do not
provide an atomic security boundary.

LocalAuth uses revision checks and conditional rollback for account/session changes.
Observers are notified only after successful transitions. Auth and profile Database
do not share an atomic transaction. Legacy auth data is not implicitly migrated.
Local credentials, email/link/provider login and tokens are disposable simulations.

## Storage, messaging and Local schema

storageId selects a physical IndexedDB; omitted/undefined uses redequate:local,
while explicit invalid IDs reject. Local Database/Auth/Storage/Messaging share it
when configured alike. Provider stores begin with $, including $auth, $storage and
$messaging; application collection/schema APIs cannot address that namespace.

Each provider supplies its own service schema lazily. Common schema code must not
import Database or individual provider schemas. LocalDatabase owns application
stores/indexes and recognizes the reserved prefix, not specific provider names.
Initialization order and concurrent additions must preserve existing stores/data.
Schema repair is explicit: do not delete or recreate developer data as a fallback.

LocalStorage persists files/metadata and provides data URLs; a URL is not proof
that an object belongs to the current user. Validate inputs and ownership before
writes/deletes. Commit must precede successful upload completion and notification.
Firebase Storage uses its SDK; Local behavior does not validate cloud Rules.

LocalMessaging persists the token in IndexedDB and checks the saved subscription
before delivery; it does not use service workers or real system push. Firebase
Messaging uses its provider token key and removes saved state only after SDK success.
Avoid duplicate registration/listeners across context replacement and unmount.
Emulator email/push simulation is controlled by FUNCTIONS_EMULATOR; real SDK
services outside that mode must not be treated as mocks.

Application Local objects store ordinary fields; scalars/arrays use _value. Legacy
_record/_encoded wrappers reject rather than being silently converted. Native _id
and selected storage identity fields are removed by the current record decoder;
source declarations/tests for identity retention need the follow-up in the backlog.
Declared indexes control queries and record addresses. No implicit new index,
compound-field synthesis or Firebase-to-Local data conversion is promised.

Local generated logical keys use firebase-key and are time-sortable within their
generator, not a global commit-time ordering guarantee. Existing/explicit keys are
unchanged. Service-owned activity indexes are distinct from source activity events;
legacy rows or missing keys need deliberate repair, not an undocumented reset.

## Database, backends and cursors

Keep one shared path grammar plus SDK-independent provider adapters. Named segments
contain exactly one string-valued field; wildcard markers stay internal and never
travel over callable/BroadcastChannel payloads. The operation decides address,
collection, create or listener interpretation. A final bare field in a collection
path selects child identity. Firebase string addresses and Local indexed paths
must retain their intentional differences.

Database prepares arguments and delegates CRUD to its linked Backend; it must not
duplicate backend storage writes or notifications. Local native transactions commit
before observers are notified. No root read, implicit collection conversion or
unindexed lookup should be invented merely to make a consumer path work.

Single-path update callbacks stay with the caller: read value/etag, prepare a value,
and conditionally replace it. Conflicts rerun preparation up to the existing bound.
Object patches preserve unspecified children but replace supplied child objects;
relative paths and root Map batches retain their explicit semantics. Undefined
callback results are no-change, null deletes. Batches are atomic replacements at
their addressed entries. Callback side effects must tolerate retries.

Firebase client writes use caller-authorized REST/callable operations, not Admin
privileges. Their read/CAS sequence needs read as well as write permission; direct
delete needs write permission. Firebase server-admin is a separate execution context.
Consumers initialize Admin themselves. Shared server invocation context is scoped
with AsyncLocalStorage; it must not leak users across requests. Native event authId
takes precedence; emulator-only owner fallback is not proof of the actual actor.
External callables use the shared wrapper when they need that implicit context.

DatabaseCursor is a runtime class; custom cursors extend the exported constructor.
Each owns id/path/count and a readonly position. Traversal is sequential; restart
with a new cursor. Handle runs on copies in scan order: undefined keeps, null
deletes, another value replaces and is reread. A failed page does not roll back
completed actions. Keep scan continuation separate from the last emitted entry.

Compositions exclusively own fresh source cursors, deduplicate by normalized
leaf path plus key, preserve source ordering and do not globally sort or rerun
handlers. Synthetic headings do not consume the data page size. Firebase inclusive
boundaries and buffering prevent premature exhaustion; Local timestamp queries and
Firebase key time are not identical snapshots. No exact concurrent snapshot or
cross-page transaction is promised.

Subscriptions do not replay initial contents as new additions. Removal is
idempotent and attempts all sources. Standalone onChildAdd uses the initial maximum
key as its addition boundary. Keep this behavior when adjusting cursor/listeners.
Detailed path, query-bound and grouping semantics remain in the behavioral contract.

## State, navigation and retained lifecycle constraints

State snapshots and selectors must be immutable and model reads must not retain
mutable SDK objects. Preserve frozen publication/initial-state baselines, unique
registration keys and provider-local stores. Provider state is selected once per
mount; registry HMR needs a full reload rather than duplicate-key reuse.
Request-local AppState is supplied explicitly after server preload; browser globals
must not serve requests. Hydration uses the prepared snapshot; automatic model
serialization and using set as preload are outside the contract.

LazyList keeps its cursor prop and defaults to live=false. Cursor replacement
invalidates the previous loading session. Owners create fresh cursors; do not
reintroduce revision counters, list caches or automatic refresh in mount/filter
effects. Layout.REFRESH remounts the routed tree; visibility refresh does not.
Rearm observation after every completed page, including a page whose transforms
all return null. Enrichment failures must settle rather than stall pagination.

Root publications use numeric to:0; replies use their parent ID. NewPost must
release its modal history blocker before onComplete navigates; the retained
flushSync ordering prevents a swallowed route transition. Publication navigation,
return-to-list behavior and real subscription cleanup need functional checks.
Do not restore the removed diagnostic tracing helpers.

## Tooling and validation ownership

[Tooling reference](tooling/docs/firebase.md) is the single source for project JSON,
SDK selection, Rules, shared Vite/Vitest, build artifacts and lifecycle commands.
The project JSON owns settings; SDK JSON remains immutable. Emulator firebaseConfig
can explicitly select its snapshot's project; inheritance remains the default.
Independent app emulators are supported; a multi-project shared suite is deferred.

Starts acquire authenticated core leases; the daemon is independent of its first
app's process tree. Each launcher stops only its services and releases its lease
after export. Never kill another session by port or a stale PID. Server watch
replaces only complete successful packages; changed dependencies require archive
preparation. Developer snapshots are persistent; tests use dedicated temporary
configs/data/ports and TMPDIR/TMP/TEMP. Do not use developer snapshots for checks.

Build captures its target and Rules; preview/deploy consume that artifact. Web
deploy publishes captured Rules before Hosting without rebuilding. Functions
remain separate. No implicit deployment or data migration is part of documentation
or tooling maintenance.

[AUDIT_BACKLOG.md](AUDIT_BACKLOG.md) retains historical unverified issues, not a
current test report. Reproduce against the current checkout before fixing or closing
a finding. Historical run counts, temporary log paths and superseded implementation
sequences belong in Git history. Do not weaken tests to hide runtime defects.
