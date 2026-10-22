# Redequate Development

This document contains persistent architectural context that is not reliably
recoverable from source code or Git history alone.

It is not a changelog.

## Project role

Redequate is the core framework used by multiple applications.

Primary consumers:

- `tujger/edeqa-pwa-react-demo` — reference/demo application.
- `tujger/thewhiskytalks` — production application.
- `tujger/thewhiskytalks-android` — Android client associated with The Whisky Talks.

The web applications are also used as integration tests for significant
framework migrations.

The preferred validation chain is:

`redequate → edeqa-pwa-react-demo → thewhiskytalks`

## Current roadmap

### Completed

#### CSS Modules / UI decoupling

The framework and web consumers were migrated toward CSS Modules and away from
direct dependence on Material UI components.

The purpose was not merely stylistic modernization. It reduces coupling between
application code and a UI library whose dependency changes can interfere with
larger framework upgrades.

Redequate-owned controls should provide the abstraction boundary for common UI
primitives where appropriate.

Material UI or another implementation may exist behind that boundary without
requiring consumers to depend directly on it.

Status: completed and merged into the main web repositories.

### Current milestone

#### React 19

Migrate and stabilize React 19 across:

- `redequate`
- `edeqa-pwa-react-demo`
- `thewhiskytalks`

The migration should be validated in the framework, reference application, and
production application before the milestone is considered complete.

Do not combine unresolved React 19 compatibility problems with the following
Vite or SSR migrations.

Status: in progress.

### Next milestone

#### Vite

After React 19 is stable, migrate the web build environment to Vite.

The Vite migration is intentionally separate from the React 19 migration so
that build-system problems can be distinguished from React/runtime compatibility
problems.

The migration should cover the requirements currently provided by the existing
build setup, including development, production builds, CSS Modules, assets,
environment configuration, library development/linking, and consumer
applications.

Status: planned.

### Following milestone

#### SSR

Add server-side rendering support after the Vite migration is stable.

SSR should be treated as an architectural capability of Redequate rather than
as an application-specific workaround.

Browser-only assumptions in framework code should be identified and isolated as
part of this work.

Status: planned.

### Product evolution

After the modernization foundation is stable, evolve Redequate toward a
business-oriented framework.

The objective is to move beyond a collection of reusable UI/application
utilities toward abstractions that allow business applications and workflows to
be created with substantially less application-specific code.

This phase should eventually support customer-oriented demos and validation
with potential customers.

Status: planned.

## Architectural decisions

### UI library isolation

Decision:

Application and framework code should avoid direct dependence on Material UI
where a Redequate-owned abstraction can provide the required control.

Common primitives such as buttons and selectors should be exposed through
Redequate-owned components.

Reason:

Direct UI-library coupling makes framework-wide dependency upgrades more
expensive and previously complicated attempts to modernize React and related
dependencies.

Consequence:

The implementation behind a Redequate control can later be replaced without
requiring changes throughout consumer applications.

Status: accepted.

### CSS Modules as component styling boundary

Decision:

Component styling should use CSS Modules, following the selector ownership and
nesting rules defined in `AGENTS.md`.

Reason:

Styles should belong to components without depending on Material UI's styling
system or creating unnecessary global coupling.

Status: accepted.

### Migration order

Decision:

Major modernization steps should be performed in this order:

`React 19 → Vite → SSR`

Reason:

Each step changes a different architectural layer:

- React 19 changes the runtime/component ecosystem.
- Vite changes the build and development environment.
- SSR changes the rendering model and browser/server boundary.

Keeping these migrations separate makes regressions easier to identify and
allows each stage to be validated against real consumers before proceeding.

Status: accepted.

### Consumer-based framework validation

Decision:

Significant Redequate changes should be validated against both
`edeqa-pwa-react-demo` and `thewhiskytalks`.

Reason:

The demo provides a controlled reference environment while The Whisky Talks
provides a real production consumer with application-specific behavior.

Passing both provides substantially stronger compatibility evidence than
testing Redequate in isolation.

Status: accepted.

### Dual module output for React 19 web consumers

Decision:

Publish an ES module entry alongside the existing CommonJS entry. Web bundlers
should resolve the ES module entry; CommonJS consumers keep the existing `main`.

Reason:

The Create React App builds used by the demo and The Whisky Talks treat the
`.cjs` entry of `date-fns` 4 as a static asset when Redequate's CommonJS output
loads `react-datepicker` 9. The calendar then receives a URL instead of the
`date-fns` API and crashes at `isValid`. The ES module path resolves the
JavaScript exports correctly without starting the Vite migration.

Consequence:

Validate both package entries and both web consumers when changing packaging
or date-picker dependencies.

Affected consumers: `edeqa-pwa-react-demo`, `thewhiskytalks`.

Status: accepted.

### Material icon package migration

Decision: use `@mui/icons-material` and `@mui/material` 9.4 with Emotion in
Redequate and both web consumers; remove the legacy `@material-ui/icons` name
and consumer npm aliases. Keep icon imports external in both library formats.

Reason: the latest legacy package belongs to Material UI 4, while MUI 9 supports
React 19. Removed `Outline` icon exports have identical `Outlined` replacements.

Consequences: consumers must install the new icon peer dependency and compatible
MUI/Emotion packages. MUI 9 requires modern browsers, including Safari/iOS 17+,
Chrome 117+, Edge 121+, and Firefox 121+. The Whisky Talks needs Grid, Hidden,
Skeleton, and removed component API adaptations. Its existing `@mui/styles`
6.4.12 supports React 19 and remains for this migration.

Rejected alternatives: staying on legacy icons 4.11.3, or keeping separate MUI 5
and MUI 9 installations. Vite and SSR remain separate milestones.

Affected consumers: `edeqa-pwa-react-demo`, `thewhiskytalks`. Android API/data
contracts are unchanged; browser-based views inherit the web browser minimums.

Status: accepted; framework and both web consumer production builds validated.
Interactive consumer validation remains pending.

### CommonJS default import interoperability

Decision: use Rollup's `interop: 'auto'` for both CommonJS outputs.

Reason: external dependencies such as MUI icons and React Datepicker expose
their components through CommonJS `default` exports. Treating the entire module
as the default import produces invalid React element types.

Consequences: preserve automatic default import handling when changing Rollup
plugins or output configuration. Validate built CommonJS components as well as
the ES module entry used by web consumers.

Affected consumers: `edeqa-pwa-react-demo`, `thewhiskytalks`; Android contracts
are unchanged.

Status: accepted; built CommonJS button and calendar DOM checks passed.

### React 19 internationalization migration

Decision: use i18next 26.4.2, react-i18next 17.0.16 and browser language detector
8.2.1 in Redequate and both web consumers. Keep the first two as framework peers
and development dependencies. Local consumer linking shares these instances
alongside React so application hooks observe framework initialization.

Reason: update the localization stack during React 19 stabilization while keeping
the build-system and SSR migrations separate.

Consequences: preserve flat translation keys, resource overrides, the existing
detection order and application-specific localStorage key. English resources can
be empty because English text comes from missing keys; `resolvedLanguage` alone
cannot select that language, so the switcher also checks available resources in
the language fallback chain. Profile locale strings retain their existing format.
Components using only `Trans` need a `useTranslation` subscription to refresh
on language changes; Contacts now passes its subscribed `t` to both translations.
Modern Intl APIs are required, and i18next no longer supports Node.js below 14
or legacy JSON plural formats. Existing dictionaries have no legacy plural keys.
The package's historical Node 8 engine declaration is not evidence of support
for the current dependency stack.

Missing-key parsing runs after interpolation in i18next 26. Preserve processed
default values; otherwise translate the prefix-stripped English key as a default
value through the same i18next instance and call options. This keeps parameters
working with empty English resources in both web consumers. Returning the raw
key from the handler leaves interpolation placeholders visible.

Rejected alternatives: keeping the legacy localization versions, enabling the
removed JSON v3 compatibility option, or bundling a separate i18next instance.

Affected consumers: `edeqa-pwa-react-demo`, `thewhiskytalks`. Android API and
profile data contracts are unchanged; browser-based views require modern Intl.

Status: accepted; framework integration tests, consumer DOM checks and both web
production builds validated. Interactive browser validation remains pending
because no browser is connected to this session.

### Uppy 6 local file preparation

Decision: use `@uppy/core` 6.2.0 with Dashboard and Webcam 6.0.1 in the
framework and both web consumers. Remove deprecated ProgressBar and unused
Transloadit, Tus and XHR Upload requirements; use Dashboard's built-in progress.

Reason: modernize the file picker while preserving the existing Firebase
publishing flow. Local resizing runs as an Uppy uploader so completion and modal
closing wait for prepared previews. Cancellation and unmount discard late results.

Consequences: preserve `onsuccess({uppy, file, snapshot})`, `_uris` and stored
image descriptors. Webcam uses public start/stop APIs and video constraints;
a React portal owns the camera switch. Keep embedded Webcam on mobile to retain
that switch instead of accepting Uppy 6's native-camera default.

Uppy is ESM-only. Bundle its JavaScript into CommonJS outputs while keeping Uppy
and its CSS imports external in the web ESM entry. Dependencies declare Node.js
22+; the historical Node 8 package engine is not a supported toolchain guarantee.

Rejected alternatives: version-only updates, deprecated ProgressBar, private
Webcam methods, and external ESM requires in CommonJS output.

Affected consumers: `edeqa-pwa-react-demo`, `thewhiskytalks`. Android API, Firebase
paths and uploaded data formats are unchanged. Vite and SSR remain separate.

Status: accepted; DOM checks cover StrictMode, local completion, cancellation,
initial descriptors, multiple files, restrictions and simulated camera lifecycle.
Production builds validated; real camera, visual mobile review and authenticated
Firebase publishing remain manual validation tasks.

### UUID and gesture dependency modernization

Decision: use Axios 1.20, device-uuid 3.0.6 and Moment 2.31, replacing
react-uuid with uuid 14.0.2 and react-use-gesture with @use-gesture/react 10.3.1
across the framework and both web consumers.

Reason: update the legacy dependencies during React 19 stabilization; the old
UUID and gesture packages are deprecated. Axios remains a framework dependency
although framework source currently does not import it.

Consequences: consumers replace the gesture peer with @use-gesture/react.
Device UUID, Moment and gestures remain peers, with matching framework dev
dependencies. Bundle uuid's browser implementation into both library formats
because uuid 14 is ESM-only; UUID generation requires browser Web Crypto.
Keep existing localStorage device_id values, synchronous device parsing and
UUID string contracts for Firebase paths and Android bridge messages. Newly
generated device fingerprints may differ after the parser upgrade; existing
stored identifiers are not migrated. Advanced asynchronous fingerprinting is
not enabled. Preserve the development-only swipe restriction.

Rejected alternative: updating the deprecated packages in place. Vite, SSR and
server-side dependencies remain separate work.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Android bridge messages
and stored data formats are unchanged.

Status: accepted; framework and both web production builds validated. Built
CommonJS DOM checks cover gestures, date/range selection and bridge correlation;
upload path/descriptor checks use a simulated storage service. Real touch
scrolling, Android WebView and authenticated uploads remain manual checks.

### PostCSS plugin build toolchain

Decision: use postcss-nested 8.0.1 with PostCSS 8 and Node.js 22.x for
framework development/builds, selected by `.nvmrc`. Keep rollup-plugin-postcss
4.0.2 and the existing CSS Modules/raw CSS configuration.

Reason: remove the nesting plugin's legacy PostCSS 7 dependency while using
the current release. postcss-nested 8 is ESM-only and supports Node.js 22,
24 and 26+; the existing Rollup `.mjs` configuration imports it directly.

Consequences: Node.js 20 is no longer supported for framework builds. The
historical package `engines` declaration remains unchanged and is not a
build-toolchain guarantee. Component APIs, CSS ownership and Android contracts
are unchanged; Vite and SSR remain separate milestones.

Rejected alternative: postcss-nested 7.0.2 to retain Node.js 20 builds.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks.

Status: accepted; framework builds and comparison of all 102 source CSS files
validated. Rules, rule order and CSS Module mappings are preserved; one comment
moves without changing behavior. Both web consumer production builds validated
on Node.js 22.23.3.

### Babel 8 migration deferred

Decision: keep Babel and its direct plugins on the latest compatible 7.x
versions; defer Babel 8 until the Rollup and ESLint integrations support it.

Reason: @rollup/plugin-babel 7.1.0 requires Babel 7. Babel ESLint Parser 8
also required an ESLint migration, which was deferred during that update.

Consequences: preserve the existing Babel and Rollup configuration. The later
ESLint 9 migration uses FlatCompat for the legacy Standard configuration but
does not resolve the Rollup plugin's Babel 7 requirement.
Rejected alternative: a local Rollup adapter and an ESLint migration as part of
this dependency update. Consumer CRA 5 toolchains retain their own Babel 7.
The latest @rollup/plugin-babel 7.1.0 still requires Babel 7; Babel 7.29.7
and Babel ESLint Parser 7.29.9 remain the latest compatible releases.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Public APIs and Android
contracts are unchanged.

Status: accepted; Babel 8 migration deferred.

### ESLint 9 with Standard presets through FlatCompat

Decision: use ESLint 9 with Standard 17.1.0 and Standard React 13.0.0 through
@eslint/eslintrc 3.3.7 FlatCompat. Keep only the original project overrides in
the flat configuration; update plugins to compatible current releases without
enabling additional recommended rules.

Reason: preserve existing checks while keeping the configuration concise and
avoiding ownership of a copied Standard rule list.

Consequences: the legacy presets declare ESLint 8 peers; accept this conflict
and install with --legacy-peer-deps, as in the existing development workflow.
FlatCompat translates configuration format, not plugin APIs; validate diagnostics
when updating tooling. Babel 7 remains; CRA 5 consumers retain their own ESLint
tooling. Public APIs and Android contracts are unchanged.

ESLint 10 remains deferred: current import 2.32.0 and React 7.37.5 plugins
declare support through ESLint 9. Node plugin 18.4.1 is ESM-only; FlatCompat
loads it through Node.js 22.23.3's require(ESM) support. Active Node.js 20.13
is too old for this plugin; use the established Node.js 22 build toolchain.

Rejected alternatives: locally copied Standard rules, recommended presets that
change checks, and reverting to ESLint 8.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks.

Status: accepted; updated plugins load without configuration changes on Node.js
22.23.3. Comparison across 301 framework/configuration files has no fatal errors
and preserves existing diagnostics except two new no-callback-literal reports:
Node plugin 18 treats react-mentions' callback([]) as an error-first callback.
The callback contract and enabled rules remain unchanged. Existing Babel
configuration errors in the legacy example directory are unchanged.
Framework and both web consumer production builds passed on Node.js 22.23.3.

### Node.js 24 LTS baseline

Decision: require Node.js >=24 in package metadata, select Node.js 24 through
`.nvmrc`, and use Node.js 24 in the Travis build matrix.

Reason: the historical Node.js >=8 declaration no longer matches the current
ESM-based tooling. Node.js 24 LTS is the selected development baseline.

Consequences: consumers installing Redequate should use Node.js 24 or newer.
Keep the existing npm requirement and dependency versions; this does not start
the Vite or SSR migrations. Existing Node.js 22 validation remains historical,
not the recommended development baseline.

Rejected alternative: retaining Node.js 22.23.3 as the baseline solely because
previous framework and consumer builds were validated on it.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Browser behavior,
public APIs and Android contracts are unchanged.

Status: accepted; framework build, ESLint configuration loading and both web
consumer production builds passed on Node.js 24.21.0. Consumer builds retain
a dynamic dependency warning and emit a non-blocking fs.F_OK deprecation warning.
The local Node.js installation and consumer package metadata were not changed.

### The Whisky Talks Vite migration

Decision: migrate only The Whisky Talks from CRA 5 to Vite 8 with the React
plugin, keeping Redequate's Rollup packaging and the demo's CRA build unchanged.
The user explicitly authorized this separate build-system milestone while the
earlier React 19 browser/device validation remains pending. SSR is deferred.

Reason: isolate the production consumer's build migration and preserve its PWA
and Firebase behavior. Use Node.js 24.12+, the framework ESM entry and Vite
deduplication of framework peers from the application root. Local library peers
need not all be installed in the framework's node_modules; resolving from there
alone fails for react-router-dom. Vitest uses the same ESM entry for the existing
smoke test instead of Node's CommonJS entry.

Consequences: preserve the build directory and hosting/deploy commands, root
URLs, manifest and Firebase messaging worker. Build the existing classic PWA
worker through injectManifest without plugin registration; Redequate owns the
update prompt and SKIP_WAITING. Define only PUBLIC_URL and REACT_APP_VERSION for
legacy framework code; the application package version is the source of truth.
Keep the accepted MUI browser minimums through explicit Vite build targets.

Rejected alternatives: generated replacement workers, automatic activation of
updates and a simultaneous framework/demo/SSR migration.

Affected consumers: thewhiskytalks. Framework public APIs, Firebase data and
Android bridge contracts are unchanged. edeqa-pwa-react-demo remains on CRA.

Status: implemented on story/migrate-to-vite; library/app builds, existing
Vitest smoke test, dev module graph, JSX/library HMR, HTTPS and preview validated
on Node.js 24.21.0. A simulated worker scope validates all 64 precache resources,
offline navigation, Firebase route exclusion, SKIP_WAITING and share target.
Real installed CRA-to-Vite updates, PWA installation, authenticated Firebase,
FCM, visual/mobile behavior and Android WebView still require manual checks;
no browser is connected to this session. No deployment performed.

### JSX source files retain the .js extension

Decision: keep React source files, including files containing JSX, as `.js` in
The Whisky Talks and the demo. The Whisky Talks' Vite configuration transforms
application `src/**/*.js` through Oxc with JSX enabled before normal React
processing, and enables JSX parsing for `.js` during dependency optimization.

Reason: retain the preferred source naming convention without reverting Vite.

Consequences: preserve React Fast Refresh and sourcemaps. The demo already uses
`.js` with CRA and requires no changes. Framework APIs, application behavior and
Android contracts are unchanged.

Affected consumers: thewhiskytalks, edeqa-pwa-react-demo.

Status: implemented; both production builds and the existing app smoke test
passed. Vite loaded 37 application modules and emitted an App.js HMR update
through WebSocket; Fast Refresh instrumentation was verified. Browser rendering
and component state preservation were not checked.

### Restore web profiles from Firebase Auth

Decision: wait for Firebase Auth's initial state before restoring the current
profile. Firebase's UID determines the user; the Redux profile cache is reusable
only for the same UID. Load public data, role and device-private data before
publishing the profile, including when the Redux cache is missing.

Reason: startup previously relied solely on the Redux cache and discarded it on
profile-read errors without waiting for Auth restoration. The later Auth watcher
does not recover a missing current profile.

Consequences: an absent Firebase session clears the profile. Auth/profile-read
errors show a startup error with a reload action while retaining the session and
stored cache; cached roles alone cannot open protected pages. Existing first-login
actions, storage formats, Firebase persistence and Android bridge APIs stay intact.

Affected consumers: thewhiskytalks, edeqa-pwa-react-demo. Android WebView shares
the web initialization change; native authentication contracts are unchanged.

Status: implemented; framework CommonJS/ESM and both web consumer production
builds passed on Node.js 24.21.0. Real authenticated reload, missing-cache
recovery and Android WebView checks remain manual because no browser is connected.

## Active issues and constraints

Add entries here only for architectural blockers or constraints that need to
survive the current development session.

Remove or convert them into architectural decisions when they are resolved.

### Callable named snackbar export

Browser validation in The Whisky Talks confirmed that the Widgets snackbar
buttons throw `TypeError: notifySnackbar is not a function`. The public controller
entry used `export * as notifySnackbar`, exposing a module namespace while the
consumer expects a callable named export. Export the controller's default function
as the named `notifySnackbar`; keep direct default imports unchanged.

Affected consumers: `thewhiskytalks`, `edeqa-pwa-react-demo` and framework
named-import call sites. Android and stored-data contracts are unchanged.
This finding does not establish that React 19 caused the issue.

Status: fixed; framework and both web production builds passed. The Whisky Talks
browser checks confirmed normal, warning and error snackbars. Full React 19
validation remains separate from these targeted fixes.

### Google One Tap uses FedCM-compatible lifecycle

Decision: remove reliance on display-moment callbacks, initialize One Tap on each
active mount, share script loading, and cancel prompts and timers on unmount.
Skipped moments can continue to the join invitation; dismissed moments stop it.
Disabled or unconfigured One Tap no longer leaves the invitation chain pending.

Reason: Google no longer supports `isNotDisplayed()` with FedCM. React lifecycle
cleanup must prevent late script callbacks from prompting after unmount.

Affected consumers: both web applications; token login and Android contracts
are unchanged. Browser-owned prompt cancellation can still log an AbortError;
do not suppress SDK errors to claim a successful authentication check.

Status: implemented and builds validated; real One Tap credential exchange
remains unverified in this session.

### Firebase 13 compatibility migration

Decision: use Firebase 13.0.0 through `firebase/compat/*` in Redequate and both
web consumers. Keep firebase-key 2.0.2, the current stable version, and require
Node.js 24.12+ for the updated dependency stack.

Reason: update the SDK while preserving the namespaced Firebase API exposed
through Firebase, firebaseMessaging and useFirebase. A full modular API migration
would also change application call sites and is deferred.

Consequences: consumer Firebase messaging workers load version-matched compat
scripts from the Google CDN and retain Firebase Hosting's `/__/firebase/init.js`.
Check `messaging.isSupported()` before creating Messaging for notification
subscription and deletion so unsupported Android WebViews retain the native
bridge fallback. Find the messaging worker through public service worker
registrations by script URL: its default scope differs from its script path,
and the SDK's former `swRegistration` property is not a public compat API.
Keep existing FCM token registration/deletion despite SDK deprecation; adopting
installation ID-based messaging would require a separate backend/data migration.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Firebase database paths,
stored notification tokens, callable Functions and Android bridge contracts are
unchanged. Backend packages, Firebase CLI, Vite and SSR remain separate work.

Status: accepted; framework CommonJS/ESM and both web production builds passed
on Node.js 24.19.0. Local checks validated the built Firebase API, pagination keys,
notification permission handling, Android subscription fallback, worker update
branches, and real CDN/Hosting worker initialization. Authenticated sign-in,
database operations, uploads, callable execution, real FCM delivery/token deletion
and Android WebView checks remain manual validation tasks. The production custom
domain was unavailable through session DNS; Hosting initialization was validated
through the application's firebaseapp.com domain.

### Browser-safe ESM entry and Vite LAN HMR

Decision: import package metadata through ESM in the framework entry; explicitly
allow `tujgermac.lan` in The Whisky Talks' Vite development server configuration.

Reason: Rollup leaves the entry's mixed ESM/CommonJS package JSON `require` in
the ESM output, causing a browser runtime error. Vite's WebSocket handler checks
allowed hosts even under HTTPS, rejecting the LAN hostname while localhost works.

Consequences: keep both library formats browser-compatible through the existing
JSON plugin and retain the public version export. Allow only the required LAN
hostname; no forced WebSocket host or protocol is needed.

Affected consumers: thewhiskytalks, edeqa-pwa-react-demo. Public APIs, Firebase
data and Android bridge contracts are unchanged.

Status: implemented; framework and both consumer production builds passed on
Node.js 24.21.0. LAN/localhost authenticated WebSocket handshakes and LAN HTTPS
application HMR passed; Widgets and framework dev modules load successfully.
Browser rendering and certificate trust remain unverified because no browser
is connected; local HTTPS checks bypassed certificate verification.

### React 19/Vite verification gates (October 2026)

Constraint: successful Rollup/Vite builds do not yet complete either milestone.
Framework `test core` still invokes removed react-scripts; existing test harness
also uses ReactDOM.render/unmountComponentAtNode removed in React 19 and imports
external gamepal-dev configuration. Consumers have no executable test script.
React-redux 8.1.3 and several legacy widgets exclude React 19 from peer ranges;
anonymous browser smoke passed but is not comprehensive compatibility evidence.

Decision: keep milestones open until the test harness and supported dependency
strategy are resolved and Auth/Storage/FCM/PWA upgrade checks are completed.
Do not restore the whole CRA build or merely broaden third-party peer ranges to
hide these gates. Test changes require the explicit authorization in AGENTS.md.

Affected consumers: edeqa-pwa-react-demo and thewhiskytalks. Demo Hosting now has
SPA fallback configured, without deployment. Current TWT checkout uses its dev
Firebase variant; building with production mode alone does not select prod
Firebase or disable source maps. Release validation must select the prod variant.

Status: framework and both consumers build; browser dev/preview rendering,
Redux progress subscription, calendar portal and Uppy Dashboard smoke passed.
Full evidence and remaining gates: MIGRATION_VERIFICATION.md. No public data/API
contracts changed; Android runtime remains unverified.

### Vitest and The Whisky Talks Emulator test gate

Decision: use Vitest/jsdom for the existing React tests while retaining Rollup
for framework publishing. Run framework component tests separately from Auth/RTDB
integration tests, with the full gate exposed through npm test and test core.
The user explicitly authorized updating existing tests. Keep gamepal-dev untouched.

Reason: CRA's runner was removed, ReactDOM render/unmount and Simulate are no
longer available, and old controller assertions depended on an unrelated backend.
Use The Whisky Talks Database rules with demo-thewhiskytalks-tests and its
default-rtdb namespace; testing a different namespace would bypass those rules.
Resolve browser Firebase Auth internals consistently in jsdom to avoid mixed
Node/browser compat exports. These aliases belong only to the integration runner.

Consequences: fixtures reset only emulator accounts/data, no production credentials
are needed, and emulator logs are temporary. TWT's existing App smoke test checks
composition without initializing remote Firebase. The old example now uses Vite,
React 19 and the framework's current named controls with its GitHub Pages base.
No public framework API or Android data/URL contract changed.

Status: 114 component tests, 38 emulator tests and the TWT App test passed after
clean installation; framework, demo, TWT and example builds passed. Dev/preview
browser smoke and production precache assets passed. The earlier missing test
runner/harness gate is resolved. Build-system migration is complete; legacy React
peer compatibility and real Auth/Storage/FCM/PWA upgrade release checks remain
separate open validation items. Commands: README.md#tests; evidence: MIGRATION_VERIFICATION.md.

### Standalone framework validation

Decision: framework tests and builds must not depend on consumer repositories.
This supersedes the application-rules choice in the preceding emulator entry.
Redequate owns its emulator configuration, demo-redequate-tests project/namespace
and minimal Database fixture rules; consumers own their security-rule validation.

Reason: a framework checkout must be independently installable and testable.
Importing a consumer's Firebase configuration reverses the dependency direction.
Copying its complete business rules would preserve that coupling and is rejected.

Consequences: fixture policies cover only the UserData paths under test and are
not production security policies. No framework API, Firebase data format or
Android contract changes. Consumer linking uses a generic helper with the target
supplied by the caller; the removed framework relink command is not restored.
Consumer scripts own installation/link orchestration.

Status: clean installation, 114 component and 38 emulator tests, Rollup CJS/ESM
and the Vite example build passed in an isolated copy without sibling applications.
Generic linking with an explicit consumer directory passed. Evidence:
MIGRATION_VERIFICATION.md. Application security rules remain consumer-owned.

### Encapsulated test infrastructure

Decision: keep framework test configuration and emulator lifecycle inside
src/__tests__. Use one Vitest config with unit/integration modes; the runner owns
emulator settings and generates the CLI JSON in its temporary log directory.
Fixtures derive their demo project/namespace from CLI-provided GCLOUD_PROJECT
and reject missing demo identity or non-loopback emulator endpoints.

Reason: separate root configs and a two-line constants module fragmented test
infrastructure. This preserves a single project-ID source without leaking test
setup into the framework build or consumers. The Vite example build remains
separate; no public API, data contract or dependency version changes.

Constraint: Firebase CLI 13.4 resolves rules within its configuration directory
and rejects external paths. Copy fixture rules into the temporary directory at
session start; restart integration watch after changing rules. Explicit --watch
is required for non-TTY use. On POSIX, signals must reach the CLI's full process
group so shutdown does not leave an orphaned Vitest watcher.

Status: 114 unit and 38 integration tests passed with the unified config, including
in the independent copy. Unit/integration watch and SIGINT cleanup passed;
missing emulator environment is rejected. Rollup and Vite example builds passed.

### Independent Auth entry points and internal common layer

Decision: publish neutral auth, auth/firebase and auth/memory subpaths with
ESM/CommonJS entries. Implementations export ready objects. Dispatcher selects
an explicitly supplied object or lazily loads the Firebase scaffold, exposes it
through a per-Dispatcher React Context and calls none of its operations yet.
Existing Firebase authentication remains active, including with a custom object.

Reason: prepare an incremental replacement boundary without migrating Login,
Signup, Logout or session restoration in the same step. Rejected alternatives:
a global registry, class/factory requirements and statically importing defaults.
Root ESM output uses .mjs and shared chunks so Auth Context has one identity per
module format and the default implementation remains lazy; CJS keeps named
exports and interop auto. Existing named root exports remain alongside default
Dispatcher.

Decision: move UserData unchanged to src/_common, keep its old controller path
as a re-export and expose shared public classes through the root. _common is an
internal source layer with no public package subpath. Auth results use UserData;
check/resolve name operations that inspect URLs or resolve redirects/tokens,
while getCurrentUser only reads cached state.

Constraint: UserData still owns legacy Firebase persistence, roles and user
state. Merely moving it does not make it backend-independent. Scaffolds reference
it only through JSDoc and do not load its runtime dependencies. Future Auth
implementations using it at runtime must resolve this coupling separately.
Core Firebase imports remain; shared ready objects may themselves share mutable
state across applications, although the new Context introduces no global session.

Affected consumers: edeqa-pwa-react-demo and thewhiskytalks. Android API, data
formats and URLs remain unchanged.

Status: Rollup, 114 unit and 38 emulator tests, demo and The Whisky Talks
production builds passed on Node.js 24.21.0. Packed ESM/CJS Auth imports,
isolated import graphs, 18 explicit stub failures, legacy UserData export
identity and hidden common paths passed. A temporary Vite consumer of the packed
entries confirmed shared Context identity; a temporary Dispatcher smoke confirmed
object identity, separate providers, mount-fixed selection and lazy default with
no scaffold method calls. Pack dry-run passed. No permanent tests were changed.
Real authenticated browser scenarios remain a separate manual validation gate.

### Root Auth/common source layout and Auth-owned build configuration

Decision: keep Auth source in auth/ and shared internal source in _common/ at
the repository root. auth/build.mjs owns its entry points, source matching and
ESM/CJS entry naming; the core Rollup config imports and applies its withAuth
helper to both builds. Output paths and public package exports stay unchanged.

Reason: Auth owns its build metadata while continuing to share the core module
graph. Building Context separately is rejected because Dispatcher and useAuth
must observe one Context per module format. Source relocation does not change
UserData behavior or remove its legacy dependencies on src controllers/Firebase.
_common remains internal, with no public subpath. The old controller re-export
preserves existing imports. Runtime modules never import the build script.

Consequences: Babel, Vitest source transformation and ESLint include the root
source directories. The example uses its file dependency and package exports
instead of an obsolete direct alias to core/index.es.js.

Affected consumers: example, edeqa-pwa-react-demo and thewhiskytalks; Android
API/data/URL contracts remain unchanged.

Status: Rollup, 114 unit and 38 emulator tests, example/demo/The Whisky Talks
production builds passed on Node.js 24.21.0. Packed ESM/CJS Auth imports and
isolated graphs, shared Context and UserData identity, Dispatcher object/default
selection, hidden common/build paths and pack dry-run passed. A temporary Vite
consumer confirmed the packed entries share Context. The build script and root
sources are excluded from published files. No test cases were added or changed;
the existing runner configuration includes the relocated source directories.

### CommonJS defaults in linked ESM consumers

Constraint: react-linkify 1.0.0-alpha exports its component as exports.default.
Linked ESM chunks can receive the entire CommonJS object from Vite's dependency
optimizer instead of the component, causing an invalid React element type.
Successful builds and imports alone do not detect this render failure.

Decision: normalize this dependency's default once in a shared adapter used by
text and audit views. Preserve either the component or its wrapped default;
retain current link decorators, mentions, truncation and disabled-click behavior.
Affected consumers: demo and The Whisky Talks; no Auth or Android API change.

Status: real-package ESM/CJS rendering passed for plain text, URL/email, mentions,
line breaks, disableClick and maxLength; both import shapes passed. All 114 unit
tests and framework/example/demo/The Whisky Talks builds passed. No test cases
were added or changed. Chrome Discover smoke passed against the current linked
build on a dedicated loopback server: ten posts loaded, text/mentions rendered,
and no console errors were captured. The audit view uses the same adapter;
interactive Activity validation requires an authenticated administrator.

### Restore web ESM import semantics after Auth extraction

Decision: restore core/index.es.js and .es.js web-core chunks without changing
the package's default CommonJS type. Retain .mjs for Auth entries and their pure
shared Context/contract/Babel-helper chunks, classified by Rollup module IDs in
auth/build.mjs. Keep the joint builds and lazy default Auth.

Reason: changing the web importer extension to .mjs changes Vite 8's CommonJS
interop to Node semantics. react-linkify then yields module.exports (an object
containing default) instead of its component. Source relocation was not the
cause. Build success alone did not detect this runtime regression.

This supersedes the web-core .mjs choice and the preceding Linkify adapter
decision. Remove the adapter and restore direct dependency imports. Rejected:
per-component wrappers and changing consumer-wide Vite interop settings, which
would compensate for the framework packaging change in application code.

Affected consumers: example, demo and The Whisky Talks. Native ESM Auth imports
and CommonJS entries remain supported; native Node rendering of the full web
core is not a new requirement. Android API/data/URL contracts are unchanged.
Status: validated. Packed ESM/CJS Auth imports and isolated graphs, Vite and
CommonJS MentionedText renders, 114 existing unit tests, and all four builds
passed. Discover loaded ten posts with mentions/tags after reload without a
React error. No component adapter or consumer interop override remains.


### Auth factories with implementation-specific configuration

Decision: each Auth implementation exports a synchronous Auth(...args) factory
returning a fresh AuthInstance. The caller owns configuration arguments and
passes the resulting object to Dispatcher. This supersedes the original ready
object export requirement.

Reason: implementations may require their own configuration and independent
state for separate application instances. Dispatcher still uses explicit
instances by reference; it never invokes an explicitly supplied factory.
The default is created once per Dispatcher mount through a lazy FirebaseAuth()
import. Construction does not authenticate or initialize Firebase; initialize
remains a separate future operation. Existing Firebase behavior is preserved.

Consumers must call the imported factory and keep the resulting object stable
(outside render or via useMemo). Method names, UserData results, subpath exports
and ESM/CommonJS packaging remain unchanged.
Status: validated. Packed ESM/CommonJS factory imports, fresh instances, stub
errors and isolated graphs passed. Dispatcher preserves explicit identity and
constructs the lazy default once. All four builds, 114 unit tests and 38 existing
Firebase integration tests passed. The Whisky Talks explicit Auth now uses a
stable Auth({firebaseConfig}) instance.


### Optional Auth base class

Decision: AuthBase, exported from redequate/auth, centralizes the existing
18 method stubs and their signatures. Built-in implementations inherit it
and retain synchronous Auth(...args) factories creating fresh instances.

Reason: implementations can override individual methods while inherited
unsupported operations explicitly fail with Not implemented. Async methods
reject Promises. Abstractness is conventional, without a constructor guard.
External modules may remain structurally compatible objects; Dispatcher uses
no instanceof check and still owns only selection and Context provisioning.
This supersedes duplicated per-implementation stubs, without adding Firebase
initialization or changing consumers' factory calls, UserData or module formats.
Status: validated. Packed ESM/CommonJS exports, inherited errors for all 18
methods, partial overrides, independent instances and isolated import graphs
passed. Dispatcher identity/lazy-default smoke, Vite shared Context, all four
builds, 114 unit tests and 38 Firebase integration tests passed. No permanent
test cases were added or changed.


### Async Auth operations with synchronous getters

Decision: all 17 non-getter AuthBase methods are async. getCurrentUser remains
a synchronous cached-state getter; get/is names are reserved for getters and
check/resolve for processing where applicable. onAuthStateChanged returns a
Promise of a synchronous unsubscribe function; checkSignInWithEmailLink returns
Promise<boolean>. All unsupported operations retain Not implemented errors.

Reason: keep operation results consistently awaitable while getters remain
immediate. Removed Auth JSDoc/typedef blocks; README documents return values,
UserData and configuration shapes. Factories, constructors and useAuth remain
synchronous. Existing components still use legacy Firebase calls, so this
contract change does not migrate current authentication behavior.
Status: validated. Packed ESM/CommonJS entries return Promises for all 17
operations and throw synchronously for the getter. Factory isolation and import
graph checks passed, as did four builds, 114 unit tests and 38 Firebase
integration tests. No permanent tests were added or changed.


### Direct default exports of Auth classes

Decision: Firebase and Memory export their AuthBase subclasses directly through
default. Applications construct stable instances with new Auth(...args) and
pass them to Dispatcher. This supersedes the earlier callable factory API.

Reason: class implementations can be exported directly without factory wrappers.
Dispatcher constructs only its lazily imported default FirebaseAuth once per
mount, preserves explicit instances by reference and does not require instanceof
for external implementations. Constructors remain synchronous and perform no
authentication or Firebase initialization. The Whisky Talks explicit Auth is
adapted to new Auth({firebaseConfig}); method behavior and module formats remain
unchanged.
Status: validated. Packed ESM/CommonJS class exports, independent instances,
AuthBase inheritance and isolated import graphs passed. Dispatcher preserves
explicit identity and creates its lazy default once. All four builds, 114 unit
tests and 38 Firebase integration tests passed; no permanent tests were changed.


### LocalAuth naming and intended use

Decision: rename the MemoryAuth scaffold to LocalAuth and publish it at
redequate/auth/local. Remove the old memory subpath without an alias.

Reason: the intended implementation is exclusively for testing, with future
localStorage or IndexedDB persistence. Memory-only naming misrepresented both
persistence and intended use. This module is not intended for production; it
remains an unimplemented AuthBase subclass and does not yet store data or
authenticate. Firebase remains the lazy default.
Status: validated. Build and packed ESM/CommonJS imports of local passed;
import graphs remain isolated from Firebase and other implementations. The old
memory subpath is not exported and no memory artifacts remain in npm pack.


### Auth contract limited to existing authentication scenarios

Decision: retain only 15 AuthBase operations backed by current runtime calls.
Remove initialize, restoreSession and getCurrentUser. Existing Firebase
initialization remains separate; session restoration uses the first auth-state
callback. Current Firebase currentUser reads are receivers for password, email
verification or profile operations and do not require a separate Auth getter.

Reason: define the contract from actual framework behavior, excluding commented
code and test-fixture setup, rather than mirroring the Firebase API. Login,
Signup, UserData helpers, Dispatcher and token retrieval for existing Functions
calls justify the retained operations. The Functions operation itself, profiles
and CRUD stay outside Auth. All retained methods are async stubs; no existing
Firebase logic or component imports are migrated.
Status: validated. Build and packed ESM/CommonJS imports passed, with exactly
15 async methods and no removed methods on AuthBase or built-in instances.
Stub errors, overrides and isolated graphs passed, along with 114 unit tests
and 38 existing Firebase integration tests. No permanent tests were changed.


### Runtime source directories inside auth and _common

Decision: keep each area's runtime source in auth/src and _common/src, leaving
root auth/build.mjs for build configuration and the top-level module directories
available for other supporting files. This supersedes runtime files placed
directly in auth and _common; the main framework still uses its existing src.

Reason: separate source from supporting files within each independent area.
Entry paths, Auth chunk classification, Babel, ESLint and Vitest source matching
follow the new directories. UserData compatibility re-exports and public Auth
exports remain unchanged. Joint builds preserve one Context per format, native
Auth .mjs imports, web-core .es.js interop and lazy Firebase selection. No
authentication implementation or UserData behavior is changed.
Status: validated. Packed ESM/CommonJS imports, isolated Auth graphs, UserData
identity and legacy re-exports, shared Context in Vite and Dispatcher identity
checks passed. Four builds, npm pack --dry-run, 114 unit tests and 38 Firebase
integration tests passed. Rollup watcher restarted with the new entry points;
no permanent test cases were added or changed.


### LocalAuth localStorage simulation

Decision: implement all current Auth operations in LocalAuth using a
versioned localStorage document per configurable storageKey. Preserve current
runtime auth-user snapshots, {user} sign-in results and synchronous from(json),
rather than the outdated README promise of direct UserData results. Import no
UserData or Firebase into the local implementation.

Reason: current Dispatcher/Login/Signup consume uid, toJSON(), {user} and
user.updatePassword(); UserData still imports Firebase services. Keeping the
simulation isolated avoids a broader UserData migration. This is test-only: fake
provider accounts and tokens, immediate verification, locally recorded password
reset requests and consumable pending email sign-in requests. Passwords are
stored in plain text. Async Auth operations simulate 0–2000 ms latency, logging
method and duration only when greater than 100 ms.

Consequences: reloads restore sessions, matching keys share state across
instances/tabs, and different keys isolate simulations. Auth replacement alone
does not remove the web applications' Firebase profile/CRUD/service dependency.
Rejected: importing UserData into LocalAuth or migrating those services as
part of this change. FirebaseAuth remains the default.
Affected consumers: demo and The Whisky Talks may opt in to this Auth module;
Android contracts and backend tokens remain unchanged.
Status: source and packed ESM/CommonJS scenario checks, isolated import graphs,
ESLint, framework build, 114 unit tests and both web consumer builds passed.
Existing Firebase/UserData integration tests have four failures out of 36:
watch/logout fixtures omit the Auth argument, fromFirebaseAuth was removed, and
fetch no longer matches the rejection expectation. Those tests do not import
LocalAuth; reconciling them with the ongoing Auth migration remains separate.
No permanent tests were added or changed.

### Minimal Messaging contract

Decision: MessagingBase exposes three async operations: subscribe() requests
permission and returns a notification token; unsubscribe() removes the device's
token registration; addMessageListener(callback) returns a function that detaches the
foreground message handler. Subscription does not attach a message handler.

Reason: these operations cover existing notification enable/disable and
foreground receiving scenarios without exposing provider SDK details.
Separate support, permission, token and initialization methods are unnecessary
for the current scenarios; message sending is outside this contract.

Consequences: token persistence in profiles, notification UI and background
workers remain caller/application responsibilities. Future provider adoption
must preserve existing FCM tokens and Android subscribeNotifications /
unsubscribeNotifications bridge calls. The incoming message format will be
defined when the existing handler is migrated.
Affected consumers: edeqa-pwa-react-demo, thewhiskytalks, thewhiskytalks-android.
Status: base stubs only; provider implementations and consumer migration remain
separate work.


### LocalAuth default and module-owned Auth tests

Decision: resolve omitted Dispatcher auth through a lazy LocalAuth import.
FirebaseAuth requires explicit new FirebaseAuth({firebase}); its constructor is
not relaxed. Significant LocalAuth overrides use individual default-export
files, with shared helpers in auth/src/local/common.js. Storage format and
authentication results remain unchanged.

Reason: make the local simulation the default while preserving explicit provider
configuration. Keep implementation helpers together without creating a file for
every short operation.

Consequences: applications omitting auth share the standard local storage
namespace for their origin. This choice replaces the earlier lazy Firebase
default; Firebase profile/CRUD/service dependencies remain separate. Demo and
The Whisky Talks already supply configured FirebaseAuth instances. Android
contracts and backend authentication remain unchanged.

Tests belong to each module's src/__tests__: Auth tests in auth/src/__tests__ and
UserData tests in _common/src/__tests__. The existing shared runner separates
ordinary unit tests from .integration.test.js emulator tests. UserData fixtures
now pass Auth explicitly and await subscription cleanup; a fresh UID isolates
the fetch permission check from Firebase's cached reads. The four integration
failures recorded above are resolved without changing UserData runtime behavior.

Status: 164 unit tests, 39 emulator tests, ESLint, framework build and both web
consumer builds passed on Node.js 24.21.0. Packed ESM/CommonJS operation scenarios,
AuthBase inheritance and isolated LocalAuth import graphs passed.


### Normalized Auth results and pure UserData model

Decision: both built-in Auth implementations return detached UserData directly
from registration/sign-in, restoration, redirect resolution and synchronous from.
Subscriptions emit UserData or null. Failures use Error with provider codes;
password changes and tokens stay on Auth. SDK credentials and user methods do
not cross the boundary. UserData.fromAuth remains a compatibility copier.

Reason: consumers need one result contract independent of Firebase. Returning
SDK users or provider-shaped wrappers would retain that coupling.

Consequences: external Auth implementations and callers must adopt direct
UserData results (id/verified/name/image instead of SDK fields). The pure model
loads database dependencies lazily; UI/current-user controls retain barrel and
legacy controller exports. Native Auth ESM uses a shared .mjs model chunk while
web core preserves its existing bundler interop. Local storage schema, default
Local selection and explicit Firebase configuration remain unchanged.
Business roles and profile persistence still require the existing services.
Affected consumers: framework login/registration/Dispatcher updated; demo and
The Whisky Talks use explicit FirebaseAuth. Android backend/token formats are
unchanged; JS clients using the previous Auth result shape need migration.
Status: 179 unit tests and 39 emulator tests passed. Framework, demo and The
Whisky Talks builds passed on Node.js 24.21.0. Packed native ESM/CommonJS Auth
operations and static import graphs passed; model creation loads no Firebase/UI.
ESLint reports no errors in the changed Auth/common modules.


### Auth JSON conversion without a public parser

Decision: remove Auth.from and UserData.fromAuth. Provider-specific internal
functions with default exports produce the existing UserData JSON shape; Auth
operations and subscriptions construct UserData through fromJSON and continue
returning it directly. JSON request time uses requested, matching toJSON.

Reason: conversion belongs inside each provider adapter, without requiring a
parser method from every Auth implementation or coupling UserData back to Auth.

Consequences: external Auth implementations return UserData directly. Callers
of the removed parsers migrate to Auth results or normalized JSON/fromJSON.
UserData detaches restored public/private/loaded data from input snapshots.
Existing UserData service imports remain in the current source; JSON converter
modules have no UserData/service imports. No storage-schema or Android backend
contract changes. Demo and The Whisky Talks retain explicit FirebaseAuth.
Provider errors pass through unchanged by explicit user decision; no operation
wrapper or error conversion helper is used. This supersedes the earlier policy
of converting arbitrary rejected values into Error.
Status: 181 unit tests and 39 emulator tests passed. Framework and both web
consumer builds passed. Packed ESM/CommonJS operation checks and removal of the
parser API passed; native ESM reports the existing typeless web-chunk warning.
ESLint passed for the changed Auth/common source and tests.


### Direct UserData JSON construction inside Auth

Decision: existing internal createUser functions form the JSON object directly
in UserData.fromJSON. Remove the shared JSON factory and intermediate converter
modules. Provider field/timestamp mapping and direct SDK errors are preserved.

Reason: the extra conversion layers add indirection without a separate consumer.
Consequences: Auth still returns UserData/null with no public parser; localStorage
and web/Android contracts are unchanged. Current UserData edits are preserved,
including its existing handling of serialized object references. This supersedes
the earlier use of separate default-export JSON conversion functions.
Status: 179 unit tests, 38 emulator tests, ESLint and framework build passed.
Packed ESM/CommonJS Auth operation checks passed; the existing typeless web-chunk
warning remains. No consumer-facing Auth result changes in this simplification.


### Remove unused Auth token retrieval

Decision: remove resolveToken from AuthBase, FirebaseAuth and LocalAuth.
Local's shared conversion helper is named toUserData and still constructs
UserData directly from account JSON. Firebase test fixtures implement SDK toJSON.

Reason: resolveToken has no production callers in the framework or inspected
web consumers. Backend requests already obtain tokens through Firebase getIdToken.
Consequences: remove the unused public method and token-refresh tests; retain the
localStorage session token field to keep existing stored sessions compatible.
Firebase SDK token access and Android/backend authentication are unchanged.
Provider errors continue passing through without wrappers or conversion.
Status: 178 unit tests, 38 emulator tests, ESLint, framework build and packed
ESM/CommonJS Auth scenarios passed, including absence of resolveToken.
The existing native ESM typeless web-chunk warning remains.


### Provider-independent Storage scaffold

Decision: StorageBase exposes four async operations:
upload({auth, blob, metadata, name, onProgress}), resolveDownloadURL(pathOrURL),
resolveMetadata(pathOrURL) and delete(pathOrURL). Upload accepts Auth and Blob/File
and returns {url, metadata}. Current adapter-compatible metadata uses contentType,
fullPath, name, size and customMetadata; progress callbacks receive percentage
strings. This supersedes the initial positional upload signature and proposed
attributes/byte-progress shape. Read/delete operations accept a storage path or
a URL issued by the provider; deletion returns no value.

Reason: these operations cover current file upload, thumbnail metadata and
obsolete-file removal scenarios without exposing Firebase references, tasks or
snapshots. Provider implementations own SDK conversion. Reject mirroring the
Firebase Reference/UploadTask API and adding unused listing, subscriptions,
task controls or metadata updates.

Consequences: providers own file naming and SDK conversion. Image processing and
replacement cleanup remain caller responsibilities. Public storage,
storage/firebase and storage/local subpaths use the existing joint Rollup
ESM/CommonJS build. Existing Firebase URLs and Android/backend contracts are
unchanged. Storage adoption in the web consumers is ongoing.


### LocalStorage IndexedDB simulation

Decision: implement all four operations using an IndexedDB database per
storageKey (default redequate:storage:local). Version 1 files store is keyed
by fullPath with a unique URL index; records contain Blob, data URL and metadata.
Upload obtains user.id through auth.resolveCurrentUser(), generates a UUID path
and adds a UUID fragment to the data URL so identical bytes remain independent.
Operations resolve only after transaction commit. Each operation simulates
0–2000 ms latency and logs method/duration when greater than 100 ms.

Reason: persist browser files across reloads and return URLs directly usable in
existing media elements. The user chose data URLs over stable local identifiers
requiring blob URL resolution on every render. Data URLs duplicate file contents
in application references and grow with file size; this is a test-only provider.

Consequences: equal keys share files within an origin; different keys isolate
them. Upload reports "0" before reading and "100" after commit. Metadata is
detached, with customMetadata containing caller fields, uid and filename. Missing
files, invalid arguments and absent users reject with storage error codes;
Auth, FileReader and IndexedDB errors pass through. No in-memory fallback or
access-control simulation. Persisted data URLs remain usable even after deletion;
deletion removes the IndexedDB record. No Firebase adapter or component changes.
Affected consumers: demo and The Whisky Talks can opt into local storage; remote
backend and Android file contracts are unchanged.
Status: framework build, public ESM/CommonJS imports and real Chrome IndexedDB
scenarios passed: uploads, metadata/progress, namespaces, identical files,
reload persistence, path/URL deletion, detached metadata and failure propagation.
No permanent tests were added or changed.

### Firebase Messaging provider

Decision: implement the three Messaging operations through the supplied Firebase
compat SDK. Check support before creating Messaging; subscribe requests browser
permission and returns getToken(), unsubscribe awaits deleteToken() without a
return value, and addMessageListener returns the SDK listener disposer. Foreground
callbacks preserve notification-or-data fields plus from, image from icon and
priority; missing notification/data yields an empty object before those fields.

Reason: preserve current receiving behavior within the minimal provider contract
while keeping subscription and listener lifecycles independent.

Consequences: unsupported browsers reject with messaging/unsupported-browser;
invalid callbacks reject with messaging/invalid-argument. Permission denial
rejects and SDK errors pass through. No import of the shared Firebase controller
or WrapperControl: Android fallback stays in existing controllers, and migrating
those callers must retain it. Token persistence, notification UI and background
workers remain outside the provider.
Affected consumers: edeqa-pwa-react-demo, thewhiskytalks, thewhiskytalks-android.
Status: provider implemented; simulated operation/payload/disposal/error checks,
ESLint and framework ESM/CommonJS builds passed on Node.js 24.21.0. No permanent
tests were added or changed. Consumer migration and real push delivery validation
remain separate work.

### LocalMessaging and console delivery

Decision: simulate Messaging with a UUID token stored directly in localStorage
under storageKey (default redequate:messaging:local). subscribe reuses it
until unsubscribe removes it; browser notification permission is not requested.
Methods simulate 0–2000 ms latency and log durations greater than 100 ms.
addMessageListener attaches a window event listener and returns its disposer. Delivery
requires a persisted token and matching storageKey; unsubscribe stops delivery
without removing listeners, so resubscription resumes it.

Reason: exercise notification receiving in a browser without Firebase or real
push services, including reload persistence and isolated local configurations.

Console API: construction installs window.redequateMessaging.send(message,
storageKey), with the default key when omitted. For example:
window.redequateMessaging.send({title: "Test", body: "Console message"}).
The initial transport (superseded by Local notification postMessage delivery
below) dispatches redequate:messaging:local:message with
{storageKey, message}. Messages are already in the public foreground callback
format; each handler receives a structured clone. Delivery is limited to the
current tab with no queue/history. Handler throws and async rejections are
logged independently. Invalid arguments use messaging/invalid-argument;
localStorage operation errors pass through without an in-memory fallback.

Consequences: console sending is specific to the local provider and is not part
of MessagingBase. Firebase and Android contracts are unchanged. Web consumers
can opt into the provider; migration of existing notification callers remains
separate work.
Status: real Chrome checks passed for console delivery, independent message
copies, key isolation, listener disposal, handler errors, storage failures and
token persistence after reload. ESLint and framework ESM/CommonJS builds passed
on Node.js 24.21.0. No permanent tests were added or changed.

### Messaging subscription check and explicit listener registration

Decision: extend MessagingBase to four async operations: checkIfSubscribed,
subscribe, unsubscribe and addMessageListener. The listener registration name
replaces onMessage without an alias; Firebase's internal SDK onMessage remains.
checkIfSubscribed returns a boolean from localStorage without SDK calls, prompts,
writes or simulated latency. Local checks its existing storageKey token.
Firebase accepts a configurable storageKey, defaulting to the historical
notification-token key, saves the token only after getToken succeeds and removes
it only after deleteToken completes successfully. SDK/storage errors pass through.

Reason: restore the existing conditional startup flow with a fast persisted
subscription check rather than attaching an unconditional startup listener.
The saved token represents application subscription choice, not proof that the
FCM registration remains valid on the server. Existing remote subscriptions
without a saved key become known locally after successful subscribe.

Consequences: Dispatcher resolves Messaging after Storage and, retaining its iOS
guard, calls setupReceivingNotifications only when checkIfSubscribed is true.
Setup subscribes and awaits addMessageListener; callbacks receive normalized
messages directly and snackbar mapping uses image/from/priority/tag and body
with a title fallback. Android fallback remains in subscription setup; native
subscriptions do not create the browser Firebase cache. The resolver's copied
Auth names are corrected. No separate subscription flag or Local data
migration is needed. This supersedes the earlier three-operation contract.
Affected consumers: edeqa-pwa-react-demo, thewhiskytalks; Android bridge names
and token formats are unchanged. Custom Messaging providers must implement the
new check and renamed listener registration method.

Status: contract and simulated Firebase cache/listener/error checks passed.
Real Chrome checks passed for Local state across reload, conditional startup
registration, iOS guard, normalized messages, storage failures, resolver and
Android fallback. Browser checks use extracted Dispatcher watcher code rather
than a full application mount. Provider ESLint and framework ESM/CommonJS builds
passed on Node.js 24.21.0; existing Dispatcher/Notifications lint diagnostics
remain, with none added. No permanent tests were added or changed.

### Internal modules grouped under packages

Decision: move _common, auth, messaging and storage into packages/, including
their src, existing src/__tests__, index.js and build.mjs files. Update runtime
imports, Rollup/Babel source matching, ESLint, Vitest and documentation paths.
Tests receive only mechanical import/mock path updates; scenarios are unchanged.

Reason: group the framework's internal modules while preserving their existing
source/support-file separation. This supersedes the top-level locations recorded
in the earlier runtime source directories decision.

Consequences: this is still one npm package, without workspaces or new package
manifests. Public redequate/auth, redequate/messaging, redequate/storage and
provider subpaths, core output paths, shared Context instances and UserData
references remain unchanged. No compatibility directories remain at the old
source locations. Consumer imports require no changes; Android APIs and stored
data formats are unchanged.
Affected consumers: edeqa-pwa-react-demo, thewhiskytalks.

Status: framework and both linked web consumer production builds passed on
Node.js 24.21.0, as did all 38 Firebase emulator integration tests, public
ESM/CommonJS module/provider imports, shared Context/UserData checks and
npm pack --dry-run. Unit tests: 177 passed, one failed on async observer error
handling in LocalAuth; the same test fails in a temporary HEAD checkout at
the original paths. That unrelated Auth issue is left for separate work.
All 321 module/configuration ESLint errors match the baseline, with none added.

### Package helpers and contract coverage

Decision: share delay, fail, notImplemented, identifier and resolvePackage in
the private packages/_common/src/_packages.js module. Providers import helpers
directly, passing complete error codes and provider names. Keep storage key
validation and observer handling within their providers.

Reason: remove duplicated package plumbing while preserving lazy provider
selection and existing error codes. The helpers remain outside public exports.
Unit coverage now includes Messaging and Storage providers, contracts, Contexts,
package build helpers and real IndexedDB transactions through fake-indexeddb.

Consequences: LocalAuth forwards asynchronous observer failures to onError;
FirebaseStorage implements resolveDownloadURL and accepts paths as well as URLs
for reference operations. Public module paths and stored data formats are
unchanged. Shared ESM support chunks must use .mjs throughout their import graph.
Resolve their source paths relative to the package source directory: Rollup's
bundled config can change import.meta.url for an imported build helper.
Affected consumers: edeqa-pwa-react-demo and thewhiskytalks; Android protocols
are unchanged.

Status: the previous LocalAuth unit failure is resolved. All 225 unit tests
and 38 Firebase emulator integration tests pass; provider ESLint and framework
and linked web consumer production builds pass. Firebase Messaging/Storage
tests mock the SDK and do not verify real delivery or cloud Storage rules.

### Backend hook public exports

Decision: expose the same useBackend hook from both redequate and
redequate/backend. The built backend entry exports BackendBase and useBackend,
replacing its copied Storage names. Include Backend sources in Babel processing
for both Rollup formats.

Reason: The Whisky Talks imports useBackend from the framework root; limiting
it to the backend subpath would require unnecessary consumer changes. Rollup
builds packages/backend/src/index.js, so correcting only the package barrel
does not correct the public backend entry.

Consequences: both import paths share the existing Dispatcher Context within
each format. Backend provider behavior and Android protocols are unchanged.
Affected consumers: thewhiskytalks and edeqa-pwa-react-demo.

Status: framework and both linked consumer production builds pass on Node.js
24.21.0. Generated ESM/CommonJS exports and shared hook references verified;
backend entry imports pass in both formats. The Whisky Talks friends, following,
main profile and Groups pages render without missing-export errors. Groups
reports a separate React list-key warning. No tests were added or updated.

### LocalBackendClient handlers and IndexedDB history

Decision: accept named synchronous or asynchronous handlers in the local Backend
constructor and return their results through request(name, args). Simulate the
shared 0–2000 ms delay. Invalid arguments use backend/invalid-argument; missing
handlers use backend/not-found. Handler failures retain their original rejection.

Persist all completed requests in IndexedDB version 1, in the requests store with
an auto-increment id; storageKey names the database. Records contain name, an
argument snapshot taken before execution, startedAt, durationMs, status and a
result or error. Error objects store name/message/code; other rejection values
are cloned directly. Uncloneable values become {uncloneable: true}. History
failures are logged without replacing the handler's result or error. Connections
close after each write and on version changes. No automatic history pruning.

Reason: let web consumers supply application-specific local functions while
retaining a persistent diagnostic history independent of remote services.
Rejected alternatives: localStorage history, a 100-record limit, and failing an
otherwise successful request when journal persistence fails.

Consequences: handlers are configured anew after reload; only history persists.
IndexedDB data remains local to the browser origin and storageKey. Consumers can
opt into this provider; Firebase functions and Android protocols are unchanged.
The default Backend resolver now imports the local client's default export and
identifies Backend correctly in validation errors.

The local client includes nine local handlers by default: fixChat,
fixPost, fixMutualStamp, fixUser, fixTag, fixMutual, mutualAction, sendMail and
sendNotification. Constructor handlers override built-ins or add new names.
Built-ins validate required arguments with backend/invalid-argument; repair
responses preserve origin/status/result and mutualAction preserves its nested
data.status shape. Mail returns simulated SMTP info, including accepted/rejected,
envelope and a unique messageId/queue identifier. Notifications return a unique
messageId per explicit token, or an empty array for uid-only requests because no
local token directory exists. Calls change no model data; mail is not sent.
sendNotification now also delivers locally through the postMessage transport
described below.
fixTag follows the consuming component's key/result contract; no server
implementation was found. This provides a usable local default without importing
application databases or server infrastructure into the framework.
Affected consumers: edeqa-pwa-react-demo and thewhiskytalks.

Status: provider ESLint, isolated Backend ESM/CommonJS builds, full framework and
The Whisky Talks production builds, and public provider imports passed on Node.js
24.21.0. Temporary fake-indexeddb checks cover history persistence/failures and
all nine handlers, including validation, overrides, async custom errors, unique
IDs and recipient variants; 15 successful and 148 rejected built-in calls were
journaled. No repository tests were added or updated. The prior framework export
blocker is resolved in the current working tree. Demo build remains blocked by
legacy fetchCallable/fetchFunction imports in its Test and Widgets pages; those
callers still require Backend migration. Real-browser validation remains pending.

### Local notification postMessage delivery

Decision: replace LocalMessaging's CustomEvent transport with asynchronous
window.postMessage using the current origin and the envelope
{type: "redequate:messaging:local:message", storageKey, message}. Backend's
sendNotification and window.redequateMessaging.send share a private sender;
Backend does not depend on the console API or construct Messaging/subscriptions.

LocalMessaging receives message events from window and, when available,
navigator.serviceWorker. Both paths validate the envelope, same origin, namespace
and subscription. Window messages also require event.source === window. Each
callback receives its own clone; disposer removes both listeners. Console send
retains its signature and configurable storageKey. The old CustomEvent is removed.

Reason: simulate foreground notification delivery through postMessage while
preserving the existing addMessageListener → Notifications receiving flow and
supporting worker-originated messages with the same local envelope.

Consequences: sendNotification posts one message to the default Messaging
namespace after validation, independent of uid/to count. It maps title/body/from,
priority/tag and image (falling back to icon), retaining its previous result array
and request history. PostMessage failures reject and are journaled; success does
not acknowledge callback completion. Unsubscribed or absent listeners drop the
message without a queue. This supersedes the earlier response-only notification
simulation. No worker registration, remote push or system-notification behavior
is added. Firebase/Android protocols and consumer worker files are unchanged.
Affected consumers: edeqa-pwa-react-demo and thewhiskytalks.

Status: ESLint, full framework and The Whisky Talks builds passed on Node.js
24.21.0. Temporary ESM/CommonJS checks using simulated window/worker events and
fake-indexeddb passed for Backend/console delivery, worker input, filtering,
subscription/disposal, clones, callback failures and send-error journaling.
Real-browser validation remains pending. Demo build still fails on legacy
fetchCallable/fetchFunction imports. Existing LocalMessaging unit tests:
3 pass and 3 fail because they expect the prior synchronous delivery; adapting
those tests requires a separately authorized test update. No tests were changed.

### The Whisky Talks Firebase Functions modernization

Decision: retain Realtime Database and the web Firebase 13 compat providers;
modernize The Whisky Talks Functions to native JavaScript ESM, modular Admin
14.5.0 and Functions 7.4.0 on the existing Node 22 runtime. Keep all 30 functions
on explicit firebase-functions/v1 APIs, with their names and response envelopes
preserved. All functions use the default Gen1 region (us-central1)
without an explicit region wrapper. Backend.request unwraps the callable
transport once.

Reason: current SDKs support Gen1 and ESM. Firebase cannot upgrade deployed Gen1
functions to Gen2 under the same name in place. Running both generations would
duplicate the existing non-idempotent counters and notifications. Defer Gen2 to
a separate rollout with duplicate-effect protection rather than expanding this
SDK update or requiring downtime. This supersedes the initial Gen2 decision.

Consequences: FCM uses sendEachForMulticast with batches of 500. SMTP is an
admin-only Gen1 callable with GMAIL_EMAIL/GMAIL_PASSWORD bound through runWith;
values are read inside the handler. mutualAction accepts {typeId, key, action},
with separate database keys, and verifies the recipient; Redequate callers and
its local handler follow that contract. Repairs await writes. User stamp repairs
require the owner or an admin, but any authenticated tag viewer can remove a
_tag/<tag>/<id> entry after the server verifies the post is absent. That branch
ignores uid for authorization and cannot modify user stamps. Reply deletion
without root skips its root counter and continues nested reply/image cleanup;
post.to is not substituted for root. Diagnostics, mail and manual notifications
require admin. HTTP fetchUser/fetchUsers/fetchConfig retain their envelopes;
fetchConfig excludes credentials and secret configuration. Pagination's first
key query has no control character boundary, which the RTDB emulator rejects.

Published Cloud Functions are named exports in their own modules; index.js only
re-exports those 30 endpoints. common/firebase.js owns configuration and reuses or
initializes the default Admin app once, so modules load independently of index.js.
Repair helpers are separate named exports used directly by fixError. Parameterized
mutual stamps share a private builder with configuration owned by their module.
Supporting model factories and unpublished legacy handlers remain unchanged;
utils.js retains named exports with explicit Firebase service arguments. This
replaces endpoint factory construction and Firebase initialization in index.js.

RTDB triggers use the standard v1 ref(path), re-exported by common/firebase.js as
triggerRef to distinguish it from Admin database.ref(path). It selects the
instance from FIREBASE_CONFIG.databaseURL; Admin reads and writes use dataRef,
the bound ref method of the shared database. Helpers and factories receiving a
database argument retain database.ref to respect the caller's database.
Keep their database URLs aligned instead of assuming instance equals projectId.

Affected consumers: thewhiskytalks and Redequate web callers. Demo Functions and
Android remain unchanged; no Android calls to these endpoints were found.

Status: Functions lint and all 30 native ESM/Gen1 exports pass locally. Framework
and The Whisky Talks production builds and its existing app test passed during
the SDK migration on Node 24.21.0. Temporary Auth/RTDB emulator checks cover
repairs, ownership, mutual actions and HTTP contracts; FCM, SMTP, Storage and
rules retrieval use mocks. Real delivery and Node 22 runtime execution were not
verified. Framework units: 253 pass, three existing LocalMessaging failures
expect synchronous delivery. Demo build remains blocked by legacy
fetchCallable/fetchFunction imports. The initial SDK migration did not add or
update repository tests.

Subsequent regression fixes separate post/reply counters in posts, deduplicate
reply alerts by recipient and retain both friendship target types. Legacy friend
relations without type resolve to users_public during repair. Functions regression
tests live in __tests__ and use node:test with experimental ESM module mocks;
standalone import checks block network access and verify the existing 30 Gen1
exports. ESLint/@eslint/js stay on 9.39.5 because eslint-plugin-react 7.37.5 does
not support ESLint 10. The unused firebase-functions-test was removed because
its Admin peer range excludes 14. Real services remain outside test coverage;
Node 22 is unavailable locally, so these checks use Node 24.21.0.

The web tag repair action now has an admin-only Gen1 fixTag callable. It rebuilds
_tag/<key> from root posts using the existing tag tokenizer and normalization,
and replaces the feed only after all pages succeed. This adds a 31st endpoint
without changing the original exports or client contract. The scan is not an
atomic snapshot; concurrent post changes remain a limitation. Regression checks
cover pagination, failed reads and registration of every client callable. PostData
instances must be created inside handlers: their database.ref() starts the RTDB
connection during deployment discovery if constructed at module scope. Import
checks now wait for deferred work and reject token requests as well as network
attempts; immediate process exit previously hid this side effect.

No deployment or cloud secret creation was performed. Future deployment must
provision the declared mail secrets. Current source RTDB rules still allow writes
at users_public, which can trigger privileged user cleanup, and mutualrequests
rules reference mutual paths. These rule issues and mutualAction retry/race
idempotency remain unresolved outside this migration.

### Runtime-independent common for Functions

Decision: packages/common is also a private redequate-common package for Node
>=22. Its root and ./common exports share index.js. The full framework's
redequate/common entry exports the neutral UserData model, UserRole, currentRole,
matchRole, needAuth, normalizeSortName and SERVER_TIMESTAMP. Common imports no
Firebase, React or browser controllers and creates no UserData instance at module
scope.

The UserData model, getters/setters, data mutation, serialization and date
formatting belong to common. UserData is a class with private instance state;
src/controllers/UserData.js extends it with persistence/cache methods and uses
_getState() as an internal subclass interface. Static fetch options are inherited.
Both exports require new UserData(...); callable construction and the {extend}
callback are removed. Methods retain instance binding for callback use, chain
identity and stored record formats are preserved. The controller also owns
current-user state and UI behavior. The web root exports the frontend controller;
Auth providers return the neutral common model. Login and Dispatcher restore a
frontend model from Auth JSON before fetching or saving profile data; Dispatcher
still prefers the saved profile for the same user. Functions can create the pure
model without a browser or database. SERVER_TIMESTAMP remains the shared {".sv":"timestamp"}
marker and restored markers are recognized by contents. This supersedes the
intermediate helpers-only common split and server/index.js entry. No workspace
or build-system migration is introduced. ESLint permits parsing without a Babel
config because the package manifest establishes a separate Babel boundary.

Reason: Functions need common imports without browser dependencies or the full
framework's Node >=24.12 requirement. They install the small package under the
redequate dependency name using file:vendor/redequate-common.tgz. The Whisky Talks
Functions predeploy runs prepare-redequate-server: npm pack creates the archive
from the sibling Redequate common package, then an explicit npm install refreshes
the installed package and lockfile integrity. The archive is generated, ignored
by Git and included in the Functions upload. Preparation requires the sibling
checkout; Cloud Build installs from the self-contained uploaded archive. Registry
publication was rejected in favor of a file dependency; source constants stay
in Redequate. Affected consumers: Redequate, The Whisky Talks Functions/web and
the demo web application. Android role values and data formats are unchanged.

Status: source and built ESM/CJS common imports, targeted model/Auth tests,
Functions tests/31 Gen1 registrations and framework/TWT web builds pass locally
on Node 24.21.0; Node 22 is unavailable. Demo build remains blocked by its old
fetchCallable/fetchFunction imports. The previous external file path was rejected
for cloud delivery because the Functions upload excludes the sibling repository.
Delivery now uses the generated local tarball. Firebase CLI 15.33.0 local source
packaging includes the tarball and lockfile. Offline npm ci and all 82 Functions
tests, including module imports and 31 Gen1 registrations, pass from the extracted
source without the sibling checkout on Node 24.21.0. Node 22 and cloud deployment
remain unverified.
No registry publication or Functions deployment was performed.

### The Whisky Talks Functions Gen2 transition

Decision: migrate all 31 exported The Whisky Talks functions to the v2 SDK while
preserving their names, RTDB paths, callable payloads and HTTP envelopes. RTDB
handlers use event.data/event.params, callables use request.data/request.auth,
and mail secrets are bound through onCall options. The shared databaseInstance
constant derives the exact instance from the Admin app's database URL without
creating a reference at module scope; handlers pass ref/instance directly to the
SDK. A trigger-options factory was removed in favor of this direct form.
Unused legacy follow/watch/reply handlers and GameData/deleteExtra/PostData were
removed after checking references. Active createAlert and tag utilities use named
exports and the shared database; tokenization is a pure utility, and normalization
comes from redequate/common. No database reference is created during import.

Runtime uses standard Gen2 CPU, concurrency and Compute Engine service-account
defaults; the initial v1 compatibility overrides were removed at the owner's
request. Admin initializes with initializeApp() and standard Firebase environment
configuration instead of manually duplicating configuration and credentials.
Region remains the default us-central1. Runtime IAM must be verified for the
Compute Engine service account before resuming users. Existing side-effect
handlers are not generally idempotent; retry remains disabled.

The chosen rollout keeps names and requires maintenance: stop client requests
and database/background writers, drain in-flight and cascaded work, delete the
deployed v1 functions, create Gen2 functions, verify cloud registration/IAM and
resume writers. Same-name upgrades cannot use an ordinary deploy over v1.
Parallel v1/v2 triggers were rejected because they duplicate counters and alerts.
Events during an uncovered trigger gap are not replayed. Manual steps and rollback
are documented in the application's functions/GEN2-MIGRATION.md; none were run.

Affected consumers: Redequate's Firebase backend and both web consumers use the
same callable names/protocol with Firebase 13; no client changes are required.
The Android shell has no native Functions dependency/calls; shared web contracts
and stored data formats are unchanged.

Status before removing legacy code: lint and all 89 mocked/regression/import tests
passed on Node 24.21.0,
including 31 Gen2 registrations, runtime options, mail secrets and instance
selection for both RTDB hostname forms. Offline npm ci and all 45 standalone
import/registration checks also pass from the locally packaged source without
the sibling repository. Node 22 is unavailable. Deployment and
cloud IAM, Eventarc delivery and client access remain unverified.

After simplification, lint and all 82 remaining tests pass on Node 24.21.0:
the eight deleted modules no longer need import checks, and a tokenization
regression was added. Registration still verifies all 31 Gen2 exports, defaults,
instance selection and secrets, with network and token requests blocked.

### Modular Firebase web services with compat Realtime Database

Decision: use Firebase 13.0.0 modular Auth, Storage, Functions, Analytics and
Messaging in Redequate and both web consumers. Retain compat app/database only
for the existing RTDB API. This supersedes the full compat decision above.
Firebase(config) returns the stable shared {app, config, database} handle, with a
modular FirebaseApp and the existing database()/database.ServerValue API. Existing
firebaseMessaging imports refer to that same handle. Provider constructors still
accept {firebase}; application method and result contracts are preserved. Repeated
initialization reuses the default app with identical configuration and rejects
conflicting configuration rather than hiding the SDK error.

Reason: migrate service adapters independently of database controllers and stored
data. Keep Firebase imports external in both framework outputs and deduplicate
the SDK in consumer Vite resolution so modular Auth and compat RTDB share the app
and authentication state. Messaging awaits isSupported before service creation
and keeps the unsupported-browser error for the Android native bridge fallback.

Consequences: only compat app/database imports remain in runtime source. App
reinitialization must use the public compatApp.delete(): modular deleteApp alone
leaves the compat app registry pointing to a destroyed app. Compat deletion clears
that registry and delegates modular service cleanup. Using private _delegate or
INTERNAL APIs was rejected. Auth/Storage/Backend retain modular service instances
for their supplied app; the existing reinitialization flow reloads the page.

Both consumers import src/firebase-messaging-sw.js through Vite's native
?worker&url pipeline. worker.format is es; hashed worker entries are emitted at
the build root, and the development server sends Service-Worker-Allowed: /.
The custom nested build and worker middleware were removed: relocating them to
vite.config.mjs reduced files but retained unnecessary build machinery. Both
applications now use Firebase Messaging, including the demo previously using
LocalMessaging. Provider options serviceWorkerURL/serviceWorkerType select
the emitted module worker; registration is lazy, cached and awaited until active.
The scope remains /firebase-cloud-messaging-push-scope, and ServiceWorkerControl
finds it by scope rather than a script URL. Hashed worker entries remain excluded
from the PWA precache. Registration failures can be retried. On fresh-instance
unsubscribe, getToken binds the custom registration before deleteToken; it requires
already-granted permission and never requests permission during unsubscribe.
Permission/token/deletion failures retain the local token for retry. Without a
custom URL, providers retain the default Firebase registration behavior.

Notification behavior belongs to the isolated redequate/messaging/firebase-worker
ESM/CJS entry. initializeFirebaseMessagingWorker(config) installs the click handler
before initializing Firebase and background message handling; consumer workers
only import this initializer, import their selected configuration and call it once.
The entry imports modular app and messaging/sw, with no React/UI, browser
controllers or compat. Importing ServiceWorkerControl directly into workers was
rejected because its UI and browser dependencies would cross the runtime boundary.
The shared handlers preserve The Whisky Talks payload.data || payload.notification
selection and notification display, tag-based existing-window focus or new-window
opening. The demo now uses the same standard notificationclick handler, replacing
its previously ineffective [fb-sw] notificationclick event. Application workers
still select their own src/firebase-config.json; The Whisky Talks variant selection
must precede the build. Firebase CDN scripts and /__/firebase/init.js are not used.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Database data/paths,
callable payloads/envelopes, notification token storage and Android bridge
contracts are unchanged. Database migration and server SDK changes remain
separate work; no deployment was performed.

Status: implemented; changed provider lint, framework ESM/CJS and both web
production builds pass on Node 24.21.0 using the currently selected development
Firebase configurations. Temporary checks verify native module-worker output,
selected project, absence of compat/CDN imports and development serving; Storage upload,
metadata/path/progress and Messaging permission/support/token/listener contracts
use SDK substitutes. Local Auth/RTDB emulator checks validate CJS signup, login,
logout, profile/password updates, protected RTDB access, server timestamps and app
reinitialization. Browser ESM checks in jsdom with shared fake IndexedDB validate
persisted Auth restoration and protected compat RTDB reads/writes. A local HTTP
callable substitute verifies authorization and single transport unwrapping. Shared
worker ESM/CJS checks using SDK substitutes validate listener registration order,
payload precedence, notification promise/error propagation, close/focus/open and
waitUntil. Native worker provider checks cover activation, registration reuse and
retry, explicit token binding, fresh-instance unsubscribe, permission/error token
retention and unsupported-browser/default-registration paths. Update checks locate
the exact Messaging scope despite script hash changes and ignore the root PWA.

Test fixture migration is now authorized and implemented: Auth, Storage and
Messaging unit fixtures mock the modular SDK; emulator fixtures use the shared
Firebase handle, modular Auth and compat RTDB. All 261 unit tests pass on Node
24.21.0; all 38 integration tests pass against local Auth/RTDB emulators.
FirebaseDatabase.read now applies limitToLast(1) only when orderBy is supplied
without equalTo, preserving scalar reads such as users_public/<uid>/updated.
The existing watchUserChanged test verifies the exact timestamp through the real
adapter, the refresh notification and the profile update after clicking Refresh.
Status: the timestamp-read blocker affecting both web consumers is resolved and
verified locally. Mocking a successful read or weakening the notification
assertion was rejected because it would hide the regression.
Real provider popup/redirect/email-link flows, cloud
Storage and Functions, FCM delivery/token deletion, installed worker upgrades,
production Firebase variant and Android WebView/native fallback remain unverified.
### Common database operation contract

Decision: DatabaseBase defines create, read, update, delete and cursor independently
of Firebase. Every first argument accepts a string path or string[] joined with
slashes; elements may include nested paths. Empty string/array denotes the root.
Provider implementations own path normalization and validation.

create(collectionPath, recordOrCallback) asynchronously creates an absent record and
returns its permanent key. The final segment names the generated key field or
supplies an explicit ID as a named segment. The synchronous callback receives
the permanent key before insertion. Both providers reject occupied keys atomically.
read(recordPath) returns plain JSON-compatible data or undefined for absence.
update(recordPath, changes) updates supplied top-level fields,
preserves unspecified fields, replaces nested values in full, and removes fields
assigned null. Absence does not cause rejection: non-null fields may create the
record; empty changes or removals alone need not create it. This aligns the
contract with Firebase update semantics without adding existence checks or
transactions. The batch form writes values at paths relative to the root.
Write failures reject.
delete(recordPath) is idempotent. Writes resolve after success in provider storage.
cursor(collectionPath, options) returns a cursor object with position,
count and next(n = 1). Position contains index, key and finished; the
initial index is -1. Optional handle controls replacement/deletion during next;
next returns up to n surviving entries. Firebase traversal, handle and selection
options are implemented; see the cursor decision below.

Reason: keep callers independent of Firebase ref/child and snapshot objects while
returning a usable permanent key only after the write commits.
The earlier for await...of API was replaced with an explicit cursor to support
explicit position and record operations. Provider references remain
internal, and path arguments stay composable. Provider-specific query and subscription contracts
remain separate work.

Affected consumers: both web applications; future Android API changes must preserve
stored paths and record formats. Status: DatabaseBase.ts expresses the contract
through exported TypeScript types/interfaces and typed method signatures.
The runtime base class and notImplemented stubs remain for provider inheritance;
removing the class in favor of an interface alone would break existing JS providers.
read and event values include scalar JSON data; update exposes path and batch forms.
Comments retain behavioral guarantees that TypeScript cannot express.
The web build, ESM/CommonJS exports, provider inheritance and base stub failures
are verified on Node 24.21.0; existing Vitest/Vite transforms resolve the TS source.
Type checking and declaration generation remain outside this conversion.
Firebase generates a push reference and uses a transaction to
create its record only when absent;
transactions require read as well as write access to the target node.
Local implementation, Dispatcher integration and Redequate consumer migration are implemented.


### Database operation error handling

Decision: DatabaseBase owns the default onError handler and shared sync/async
operation wrapper. Constructor onError defaults to throwing the original error;
operation options.onError overrides it. The handler receives (error, reason,
context), where reason names the operation and context contains its arguments,
without Firebase references or snapshots. A normally returning handler makes the
failed operation return undefined; its return value is ignored. Handler exceptions
propagate without being reported again. Handlers are synchronous.

Firebase applies this to direct methods, create, cursor.next, listener
removal, subscription errors and user listener callbacks. Deferred operations use
the options supplied at invocation. Batch update accepts options as its second
argument. Synchronous factories remain synchronous. TIMESTAMP uses the constructor
handler; increment accepts operation options.

DatabaseBase.addEventListener owns callback/error handling and removal error
handling. Providers call super with a subscription factory; Firebase's helper
only maps snapshots and manages SDK subscriptions, including partial cleanup.
Synchronous registration callbacks retain the guard against reporting a thrown
callback/onError failure twice.

Reason: keep error reporting and policy independent of Firebase without changing
successful results or forcing a handler on callers that prefer rejection/throw.
Types now include undefined for handled failures of operations returning data.

Affected consumers: Redequate, demo and The Whisky Talks web/Functions callers.
Defaults preserve existing throwing/rejection behavior; callers installing a
non-throwing handler must accept undefined results. Stored formats and Android
protocols are unchanged. Status: implemented for Firebase; Local operations
remain unimplemented and consumer integration verification is pending.

### UserData class inheritance

Decision: common UserData and the web controller are classes; the controller
extends the common model. Construction requires new, replacing the callable
factory and extend callback. Private state is accessible to subclasses through
_getState(), and JSON contains only the existing record fields. Methods previously
implemented as closures remain bound to instances for detached callback use.
Reason: use explicit inheritance for model extensions and shared static options.
Affected consumers: Redequate web, demo, The Whisky Talks web and Functions.
Runtime factory calls in Redequate and The Whisky Talks must use new; Auth already
constructs injected models with new. Android data formats are unchanged.
Rejected: a compatibility factory, because both exports should be actual classes.
Status: Redequate, demo and The Whisky Talks web builds pass. Runtime checks
confirm subclass identity, isolated state, matching model JSON/getters, detached
callbacks and built ESM/CommonJS exports. Targeted common/Auth suites have 50
passing checks and three failures from unchanged calls without new. Existing
tests using callable construction or extend are intentionally unchanged at the
user's request and require migration before those suites can pass completely.
Functions production sources have no callable UserData construction; their tests
still contain callable/extend cases. No Functions deployment was performed.

### Internal global state contract

Decision: use internal GlobalStore and inheritable UseAbstract with AppContext
for new browser state. Module-level registration creates one store per key;
the default browser AppContext uses globalAppState so values survive component
and provider remounts. Updates notify only that store's subscribers through
useSyncExternalStore, with Object.is suppressing unchanged values.
Other Redux state remains during incremental migration; the generic state classes
stay internal.

GlobalStore owns deepFreeze in both development and production. Writes evaluate
the updater, apply the pure normalization callback supplied by UseAbstract,
freeze the result and then check
Object.is before storing/notifying. Initial values follow the same preparation;
isolated AppState stores retain the normalization callback through fork(). Forks
without supplied seeds reuse the prepared immutable baseline without normalizing
it again; reset restores that exact baseline without another normalization.
Own data fields of objects, arrays and class instances are traversed/frozen through
descriptors, without invoking getters or freezing prototypes. Functions and
accessor functions are not traversed/frozen; their references are preserved.
Mutating frozen data through a model method is prohibited in every environment.
Web UserData keeps its database service and visit counter in #database and
#lastVisitUpdate so reflection does not freeze shared services or runtime bookkeeping.
Writes preserve the supplied value's identity; no cloning or serialization occurs.
UserData.toJSON owns deep copying of exported model data so each export is
independent and a new model can edit a frozen user's export without sharing nested references.
This does not copy values on store writes or alter the JSON record format.

The currentUserData hook owns the current UserData instance, including prototype,
methods and provider dependencies. Its existing [value, setValue], value-only/set-only
hooks and imperative getter are exposed through the web controllers API. Its
initial value is new UserData(); null/undefined writes create a new anonymous model.
Models without id retain their other fields for a future login merge. Automatic
merging is not implemented. The previous snapshot conversion/read-model cache
was rejected because it removed model functionality and changed reference identity.

The legacy UserData accessor, current-user Redux reducer/actions and React bridge
are removed. Dispatcher and login/profile/language handlers publish actual models.
Logout resets the hook only after successful Auth sign-out; watchers use getter/
update callbacks and ignore results for a different session user. Local operations
may construct separate models, but the hook stores exactly the model they publish.

Different hook keys own different stores: writes do not replace other values or
notify other subscribers. Deliberately storing one object in multiple stores shares
that reference. Mutating an instance and reassigning the same reference does not
notify because Object.is sees no replacement. Mutable built-ins (Date, Map/Set,
their weak variants, buffers/views, RegExp and URL types) are rejected, including
ordinary values from other realms. These objects retain mutable internal slots
after Object.freeze. Arbitrary classes must keep observable data in own data
fields and derive getters from those fields; private services and bookkeeping
remain the model author's responsibility. Proxies and side-effectful getters
are not an immutable-state abstraction.

Current-user Redux/localStorage caching is removed: existing persisted user fields
are discarded during Redux restoration, while other stored slices remain.
Auth.resolveCurrentUser restores the user on page load, returning an anonymous
UserData when signed out. Firebase waits for authStateReady; both Firebase and
Local listeners also return anonymous models. Dispatcher stores that Auth
result through the hook and enriches signed-in profiles from database; Redux does
not decide how to resolve the user. This avoids a second state owner;
keeping the Redux bridge or a separate local user cache was rejected. The web
consumers now use the specialized model hook API; backend/Android record formats are unchanged.
Full application SSR remains deferred; the state-layer contract below is supported.

Affected consumers: both web applications are migrated to the model hooks;
the legacy UserData accessor and current-user Redux slice are no longer supported.
Android data formats are unchanged. Full Dispatcher/application SSR remains a
separate migration. Status: React DOM checks verify direct model identity and methods,
anonymous data/reset, separate hook types and subscriber isolation, Object.is,
GlobalStore preparation for shared/isolated stores, production behavior and logout.
Class-field checks verify frozen model data, unchanged method/accessor references,
no getter evaluation, and mutable private database/visit bookkeeping.
Write-order checks verify updater evaluation before normalization, freezing before
notification, and Object.is suppression against the normalized value.
Framework ESM/CommonJS and both consumer production builds pass. Demo useBackend imports now use the root export.
Existing test fixtures for the removed accessor/reducer require a separate
authorized migration; no test files were changed in this session.

### Immutable state and request-local hydration contract

Decision: keep UseAbstract/GlobalStore/AppState internal, class-based and without
new dependencies. Freeze snapshots in production as well as development, using
an iterative descriptor traversal and a WeakSet cache of successfully frozen
graphs. Reject known mutable built-ins rather than clone or wrap them. Store
notifications use the subscriber list captured at the start of the update;
new listeners wait for the next update and removed listeners are skipped.

Reason: production mutation previously changed snapshots without notifications;
Object.freeze does not protect built-in internal slots. Fork/reset repeated
normalization and could change initial values. AppState kept a caller-owned seed
map by reference. These are concrete state bugs, rather than a reason to add a
state-management library or a lifecycle manager.

SSR: create a new createAppState(initialState) for every request, after loading
the initial data. AppContext accepts an optional state prop for that instance;
state and initialState are selected once per provider mount. Without state it
creates a local state on the server; browser defaults still use globalAppState.
The seed map is shallow-copied and its values frozen at AppState construction,
while individual stores remain lazy. Server get/set/reset require an explicit
local AppState; globalAppState access and server hooks outside AppContext fail.

Hydration: getServerSnapshot always returns the immutable prepared initial
snapshot, even after set. Transfer the same initial data to the browser and
reconstruct application model instances where needed before creating its state.
Serialization/model reconstruction belong to the application; no automatic
snapshot transport or class serialization is introduced. Do not use set for
server preload: complete the preload before createAppState(initialState).

Registration: module-level constructors still register automatically. Ordinary
cached imports reuse the module; a duplicate key fails even with matching initial
data. HMR re-execution of registration requires a full page reload. Tests that
need a fresh registry reset the entire module graph, including the Context.
Rejected: implicit duplicate reuse, HMR compatibility inference, built-in wrappers,
deep cloning, derived stores and a simultaneous full-application SSR migration.

Affected consumers: edeqa-pwa-react-demo and thewhiskytalks retain model identity,
hooks and client defaults. Native Android APIs/data/bridge formats are unchanged;
web views receive the production immutability contract. Model edits must complete
on a replacement instance before publishing it.

Status: implementation and targeted unit/React/SSR/hydration checks are complete.
Verification results and pre-existing fixture failures: STATE_AUDIT.md.

### Complete login preparation before publishing immutable models

Decision: finish the login model's notification-token update and database save
before publishing it through useCurrentUserData. Notification failures retain
the existing nonfatal login behavior. Disabled users are still published and
redirected to their profile without subscribing. Already published models are
immutable; later edits require replacement models.

Reason: publishing before notification setup froze UserData.private, causing
setPrivate/savePrivate to fail. Preparing the model first fixes this without
copying it or weakening the store's production immutability. Login's mount effect
must also run before its signed-in early return to preserve React hook order.

Consequence: login waits for the notification attempt before publishing its
current user. Keep the existing permission policy and subscription conditions.
Rejected: removing freeze, cloning for this initial preparation, and publishing
an additional notification-specific replacement when reordering is sufficient.
Affected consumers: both web applications and their embedded web views; native
Android, authentication/provider APIs and stored token formats are unchanged.
Status: seven Login regressions and 70 state tests pass; five regressions fail
against the original Login implementation. Framework and both web builds pass.

### Provider-owned UserData timestamp markers

Decision: common UserData formats resolved numeric dates and owns no provider
timestamp marker. SERVER_TIMESTAMP/constants.js are removed from common and web
exports. The web controller handles its database.TIMESTAMP by identity, then
delegates ordinary dates to common; it also works without a database and leaves
empty dates empty. Do not reintroduce Firebase marker-shape checks into common.

Reason: timestamp sentinels belong to database implementations. A runtime-neutral
model must not interpret Firebase's .sv shape. The frontend guard prevents
created/updated getters from dereferencing a missing database.

Affected consumers: both web applications and The Whisky Talks Functions. Test
fixtures use provider-owned markers; the Functions common contract test uses
new UserData and subclasses instead of the removed callable/extend API. Native
Android and stored record formats are unchanged. Consumer vendor packages need
their normal refresh before these updated tests target the installed new API.

Status: 17 UserData unit tests, 77 state/Login tests, all 33 UserData emulator
tests and five Functions common tests against the fresh server build pass.
Web/server ESM/CJS builds pass. Functions vendor/lockfile were not refreshed;
the Functions test was validated in a temporary package-resolution environment.
Existing Auth/UI fixture failures remain outside this update.

### Publication repair compatibility and concurrent tag indexing

Decision: The Whisky Talks supplies its Backend to every postItemTransform call
using default missing-publication recovery. fixUser counts reply keys from both
modern posts (with to) and legacy replies, deduplicating matching keys. Both
collections must finish reading before post/reply counters are written; pagination
callbacks enforce exact uid matching because subsequent equal-value pages use a
prefix range in the existing Pagination helper.

fixTag reads its initial index before scanning posts and applies repairs in a
transaction on the target feed. Only entries whose current value still matches
the initial value are changed; concurrent additions, changes and deletions are
preserved. Whole-feed replacement was rejected because it erased links for posts
created during the scan. This is not an atomic snapshot of posts: parallel text
changes and same-value delete/recreate operations remain unresolved limitations.

Affected consumers: The Whisky Talks web and Functions. Callable interfaces,
stored record formats and Android contracts are unchanged. Legacy replies are
counted without migrating or deleting them. Status: implemented; validation is
recorded in the session result. No deployment performed.

### Root publication marker

Decision: PostData.publish stores to: 0 for root publications and the parent ID
for replies, matching NewPostComponent and Discover's to == 0 query. A null
marker was rejected because RTDB removes that field and excludes the publication
from Discover. Mock refreshes the discover cache after successful publication.
Affected consumers: both web applications; Android receives the established
root-publication format. Existing records without to require separate repair;
no stored-data migration or deployment is performed. Status: implemented.

### Mutual consistency repair

Decision: fixMutual({uid, typeId}) reconciles that user's directional relationship
and incoming-request counters. Optional id and legacy NOT_FOUND calls additionally
check a specific owned link. friend uses approval requests; following subscribes
without approval. Erroneous following requests are completed as missing one-way
subscriptions, while valid friend invitations remain pending. Missing request
participants cause cleanup. Legacy friend/following targets resolve to users_public.

Counter baselines and data repairs share one multipath update. Existing relationship
triggers apply newly created/deleted link deltas; baselines must not pre-apply those
deltas. Simultaneous repairs, delayed trigger retries and concurrent relationship
changes are not fully protected; a separate concurrency protocol remains deferred.

The previous invitation action/UI changes were rolled back. ProfileWithFriends
uses an uncached Requests list and invokes repair once for a successfully read
empty first page with a positive counter. Transformation failures are not emptiness.
Affected consumers: Redequate controls/Local Backend, The Whisky Talks Functions
and web; demo retains the same optional component API. Stored paths and response
envelopes are preserved; id/code are no longer required for a general fix call.
Status: implemented; no deployment or remote repair performed.

### Independent server archive and browser boundary

Decision: packages/server is a maintained private redequate-server package,
with its own manifest, build configuration, README and lockfile. It builds
common, backend/common, backend/common-server, backend/firebase-server and
backend/local-server into packages/server/dist in native ESM/CJS. The root
export aliases common. packages/common is a shared source directory, without a
separate package manifest or lockfile. Both builds consume its source entries;
server packaging and dependency ownership belong exclusively to packages/server.
Removing the common manifest also removes its separate Babel configuration boundary.

Runtime dependencies belong to the server manifest. firebase-admin ^14.5.0 is
installed by npm; declared dependency subpaths and Node builtins remain external
to Rollup. Root development dependencies provide build tooling. Functions install
the generated vendor/redequate-server.tgz under the redequate dependency name,
preserving existing imports; preparation refreshes lockfile integrity.

Preparation is owned by packages/server/prepare-redequate-server.mjs and takes
the target Functions directory as its required argument. Both web consumers
invoke it from their npm commands and Firebase predeploy, avoiding duplicated
build/pack/install logic. The demo also uses the server archive instead of the
retired common package. Preparation needs the framework's Node.js 24.12+ build
toolchain; deploying the prepared archive needs no sibling framework checkout.

Shared preparation validated on Node.js 24.21.0 in both consumers: archive
integrity matches lockfiles, lint and common imports pass, isolated archive
installation supports ESM/CJS. The Whisky Talks Functions tests pass 88/88;
demo tests pass 12/13. Its existing notification test expects no notificationType
field, but functions/index.js already returns it. This consumer-specific fixture
mismatch remains unresolved; no test files or notification behavior changed.

The main redequate package contains common/client entries only. The browser build
rejects server source imports; the server build rejects client/UI sources.
Reason: make server packaging and dependency ownership explicit without coupling
Functions to frontend code. This supersedes the generated server-manifest approach
and the earlier decision against a maintained server package. Joint frontend/server
builds and shipping server entries inside the main package remain rejected.

Affected consumers: both web applications and The Whisky Talks Functions.
Backend entries are currently empty; implementation is separate work. Android data
formats and callable contracts are unchanged. Status: framework and both web builds,
lint, ESM/CJS entry imports and opposite-side rejection, prepack, isolated archive
installation with firebase-admin and local SDK initialization pass on Node 24.21.0.
Functions tests pass 86/88; two existing common tests still call UserData without
new and require a separately authorized fixture migration. No test files changed.
Node 22 and deployment remain unverified; no publication or deployment performed.

### Incremental TypeScript source support

Decision: web and server Rollup builds accept .ts and .tsx alongside existing JS.
Babel 7's TypeScript preset removes types; the React preset transforms TSX.
Extensionless imports resolve existing extensions first, then .ts and .tsx.
Type-only declare fields are removed. Public entry paths and emitted ESM/CommonJS
formats remain unchanged. Server Babel configuration applies only to TS/TSX,
without loading the browser configuration or downleveling existing server JS.
Its source boundary permits the internal Babel helper module while continuing
to reject frontend sources; the browser boundary still rejects server Backend.

Reason: allow contracts and individual modules to migrate incrementally without
requiring a framework-wide conversion. Mandatory type checking, declaration-file
generation and ESLint migration are separate work; transpilation does not validate
types. Root development dependencies own this tooling, including the server build.

Affected consumers: both web applications and the server archive continue to consume
JavaScript through existing exports. No Android API or record-format changes.
Status: web/server builds and service/server ESM/CommonJS imports pass on Node
24.21.0. Temporary TS/TSX fixtures verify interfaces, type-only imports, declare
fields, typed classes, extensionless resolution and both source boundaries.
All four existing package build-helper tests pass; no test files were changed.
Source-file conversion, consumer builds and publication are not part of this step.

### Dispatcher-owned console error logging

Decision: Dispatcher installs its console.error wrapper at effect startup, before
database resolution. A closure supplies the resolved Database provider later;
create(["errors", "error_id"], value) stores the error string, provider TIMESTAMP and current
user ID. Until the database is available, logging prints the original error and
a notice that it was not saved. Provider failures go directly to the previous
console handler, avoiding recursive logging. Cleanup restores that handler only
if Dispatcher still owns the current wrapper; late resolution after cleanup
cannot reinstall it. One active Dispatcher owns the global wrapper.

Reason: remove Firebase access from error capture and tie the wrapper to application
lifetime instead of module import. A database failure must not suppress console
output or create an unhandled rejection.
Affected consumers: both web applications; errors paths and stored fields remain
unchanged, with no Android API changes. Status: direct checks verify provider
availability, current-user lookup, failure handling and StrictMode-style cleanup;
the web build passes on Node 24.21.0. No test files were changed.

### Database cursor with sequential handle processing

Decision: replace iterate with cursor(path, options), returning an object with
readonly position ({index, key, finished}), count, next(n = 1)
and optional options.handle. DatabaseBase assigns each ordinary or composed cursor
a readonly id, stable throughout its lifetime and unique to the instance, so
web consumers can reset observer lifecycle when the cursor changes.
Providers obtain this identity through super.cursor(); Firebase cursor.js owns
cursor construction and delegates composition to composeCursor. Internal sources
have no id; composeCursor handles creation/next errors using each
source's effective options, while atomic cursors throw directly.
next returns up to n surviving entries. Initial position is
{index: -1, key: undefined, finished: false}; the first entry has index 0.
Reading past the end returns [] and retains the last position with finished true.
Restarting traversal requires a new cursor; reset was removed. No current entry is exposed; live cursors
also deliver entry changes through subscribe.

Reason: make traversal position explicit and retain it across record operations.
The working async iterator and its filtering/pagination/callback logic were removed
so this contract can be developed incrementally. Overloading next with scalar
versus array results was rejected; it always returns an array. Dedicated cursor
update and delete were removed; mutations during traversal belong to handle.
No current Firebase reference is retained outside element processing.

The current contract and provider pass handle a structuredClone of {key, value}
(the proposed value/key signature is not present in the current sources). It runs sequentially, awaited
before advancing. Undefined means no automatic write and discards input mutations;
results retain the original read value. Null deletes the candidate without
advancing index. Every other result fully replaces the record, even the same object
reference or false/0/empty string. Replacements are reread for server-resolved values;
records absent after rereading are treated as deleted. next continues reading until
n survivors or collection exhaustion, so a call may process many deleted records.
Use position.finished to detect completion; exact full batches may need another read.

Position advances after each successful survivor. Errors stop next at the last
successful survivor, with no processing of subsequent elements. Completed database
or external actions are not rolled back; failed post-write reads can cause repeat
processing on retry. Methods are called sequentially, outside handle. No global
snapshot or exact index under concurrent collection changes is guaranteed.

Affected consumers: the new web Database API replaces iterate; no consumer uses
it yet. Functions/Admin Pagination, server exports and Android formats are unchanged.
Selection uses orderBy (field path), equalTo (exact equality),
inclusive start/end and order (asc by default, or desc). Names follow read/listener
orderBy/equalTo and Pagination order/start/end. A string start without end implies
end = start + "\uf8ff" for prefix matching; numbers retain an open upper bound.
Desc yields rows in descending order. startDate/endDate independently constrain
record keys using firebase-key minimum/maximum keys for their milliseconds.
With orderBy, Firebase cannot also range-query keys: the cursor filters the key
range before handle and fills the requested number of survivors, potentially
reading extra rows. Dates do not change field ordering and can accompany equalTo.
Without orderBy/equalTo, dates supply unspecified query bounds; explicit key
bounds and date bounds are intersected through the cursor's key filter.
Existing Activity cursor callers now pass dates through startDate/endDate.
Without orderBy, a defined equalTo selects orderByValue; otherwise ordering is by
key. Presence is checked against undefined, so false, zero, empty string and null
also select value equality. Continuation uses the original record value plus key
to traverse ties in both directions, retaining block caching and date filtering.
This supports the scalar roles/<uid> structure used by Users admins/disabled
without a new option or changing stored data. Explicit field ordering retains
priority over value ordering. Value-range ordering and timeout remain outside
this step.
False, zero, empty string and null are valid field-query bounds; key bounds must
be strings. Equality excludes start/end, but not dates. Missing sort fields are null;
object sort values reject before handling. Index is relative to the selection.

createCursorQuery owns validation and construction of immutable first-page and
continuation templates at cursor creation; reads start at next or a live
subscription. Continuation
uses the original scalar sort value plus key, captured before handle, to traverse
ties. The opposite range boundary remains in effect on all pages, including exact
equality. Continuation uses inclusive startAt/endAt and requests one additional
row, removing the previous boundary key only if present. Desc uses limitToLast
and reverses each page. Exclusive startAfter/endBefore were rejected after a real
Firebase response returned limit-1 despite further matching records, causing
premature exhaustion; a similar SDK issue is tracked at
https://github.com/firebase/firebase-admin-node/issues/2350.
If the boundary was deleted, all fetched rows are retained and any extra row stays
buffered. This changes provider traversal only; stored data and consumer APIs
remain unchanged. Real-environment confirmation of the workaround is pending.
Changing sort fields through handle or concurrent writes may repeat or omit rows.

Cursor composition accepts a non-empty array of flat {path, ...options} sources.
String arrays, including [], remain single paths. Source options override outer
options; explicit undefined removes an inherited setting. Nested compositions
are not supported. A small coordinator alternates sources, retains the turn
between next calls, and returns at most n unique entries without a global sort.
Each source reads a block sized by the current outer next(n), retaining unread
Firebase snapshots until consumption. A new n changes only the next refill size.
Round-robin next(1) consumes these blocks locally instead of issuing a network
read for every record. Prefetch does not invoke handle or advance public position;
date/duplicate filtering and handle run at consumption, with failed candidates
retained for retry. Query exhaustion does not finish a source while its buffer
still contains candidates. Per-record network reads
were rejected because composition was much slower than AllUsersPagination.
Identity is normalized collection path plus key, not key alone. Internal hooks
skip duplicates before handle and mark successful processing, including deletion;
failed handling remains retryable. This prevents repeated mutation when name and
email searches find the same user. The coordinator handles each source failure
once with that source's effective onError. A handled failure stops next with
undefined, preserving completed progress. A new cursor starts a fresh traversal and deduplication lifetime.
Users combines normalized-name and email searches (email only for a non-empty
filter). Stored formats and Android protocols are unchanged. Both web consumers
continue on story/move-database-to-module; consumer runtime validation is pending.

Cursor count starts at zero and counts entries returned by successful next calls,
plus delivered add notifications minus delivered remove notifications; change does
not affect it. Atomic sources count independently, while composition counts only
its own returned entries and forwarded notifications. Buffered or filtered entries
do not count. Repeated deliveries, including independent subscriptions, count again;
count is not a unique-key cardinality and may be negative for unread removals.

Cursor subscriptions are activated by subscribe(listener), without a live option.
Each call independently attaches child_added/child_changed/child_removed to the
configured query and returns a flat subscription object with unsubscribe(), the
cursor id, subscribed (creation time as a Date), active and
added/changed/removed counters. Each public subscription maintains independent
counters, incremented before invoking the listener; composition counts forwarded
events without deduplication. Successful unsubscribe sets active to false and
retains the metrics. Internal source subscriptions have no metrics.
A one-time value read marks
baseline completion; initial events are skipped. Events carry type and an entry
with key and value, identical to entries returned by next, without a display index. Date key bounds are
also applied locally when field ordering prevents querying both dimensions.
Composition forwards each source's events directly, including overlapping results,
and releases all source listeners through one unsubscribe. Errors use the source's
effective onError. Subscription events do not invoke handle, update traversal
buffers or alter position.

Reason: build subscription behavior incrementally. The previous combined live,
render-order, cache synchronization and handler-processing implementation was
rejected as too complex. Keep notifications independent of traversal at this step.
Do not mirror the list's loaded records or compute notification indices in the
cursor: that would require synchronizing two mutable collections. The list owns
its displayed records and applies changes/removals by record
key, ignoring unknown keys. Subscription events retain the simple {type, entry}
shape. LazyList shares addition between pages and live events; changes and removals
are handled only in the subscription. Pages append; live additions prepend for
desc and append for asc only after the displayed traversal is finished. This
assumes new records fall at the ascending end, as with timestamp keys; arbitrary
orderBy insertion is not supported. The public readonly cursor.order exposes the
outer direction (asc by default), including for compositions. Page loads and notifications run directly,
without an operation queue; asynchronous transformations apply on completion,
so strict event ordering is not guaranteed. Serialization was rejected to keep
the component simple. Cursor changes invalidate the old session; toggling
live only changes the subscription. Finished state is preserved by live events.
Stored data and Android protocols are unchanged; web runtime validation is pending.

Status: Firebase traversal and independent subscription notifications are implemented.
Move remains deferred. Simulated
Firebase checks cover deep input isolation, sequential callbacks, result values,
survivor filling, partial failures/retry, handle deletion and ordinary traversal.
Web build and ESM/CommonJS checks pass on Node 24.21.0; selection checks cover both
directions, duplicates, exact equality, inclusive/falsy bounds, nested/missing fields,
independent cursor lifetimes and handler progress across pages.
Tracked FirebaseDatabase unit and emulator integration suites now cover CRUD,
transactional drafts, selection, cursor buffering/composition, count, handlers,
listeners and error routing. The local RTDB emulator confirms the 83-record
equal-value pagination regression in both directions, deleted continuation keys,
server values and subscription behavior. Test-only access is limited to the
database_test branch in emulator rules; production rules are unchanged.
Production RTDB validation and consumer migration remain unperformed.

### Local provider naming

Decision: use local/Local names throughout the local providers, including public
module paths, classes, build entries, storage keys, events and simulated tokens.
Reason: apply one name consistently across the framework's local implementations.
Old imports have no compatibility aliases; existing local data stays under its
previous keys and is not migrated or deleted. Applications using local providers
must update imports and start with the new default storage namespaces, or pass
their previous storageKey explicitly. Firebase data and Android protocols are
unchanged. No old provider names were found in the inspected web consumer source
or Android app source. Compatibility aliases and automatic data migration were
rejected for this complete rename. Status: framework and server builds, all 134
affected unit tests, and ESM/CommonJS entry checks passed on Node.js 24.21.0.

### Cursor records, identity and composition

Decision: cursor records, handle inputs and subscription events use DatabaseEntry
{key, value}; remove DatabaseCursorEntry and per-record path metadata. Cursor
identity remains available through id, and collection identity through path.
Compositions retain each returned record's original leaf cursor internally,
including nested compositions and custom DatabaseCursor subclasses.

Deduplicate by normalized leaf cursor.path plus key; use cursor.id plus key when
path is absent, keeping the two identity namespaces distinct. The proposed move
to id-only deduplication was rejected because separately created selections of
the same collection must continue suppressing overlapping records. Each source
still performs its own handle before buffering; composition does not rerun it.

All FirebaseDatabase.cursor calls return compositions, including a single path.
Returning FirebaseCursor directly was rejected to keep grouping, error handling
and subscription metadata in one implementation. Null and undefined source-array
elements are skipped; an empty composition finishes without records. String
arrays, including [], retain their meaning as collection paths.

Sources retain only their cursor, buffered entries, offset and pending group
headings. Original request arguments are retained solely for validation error
contexts. Caller-owned custom cursors must call super.next(n), be fresh and be
used exclusively by their composition. One lifecycle indicator tracks use;
public position.index/key/finished and count are retained.

Affected consumers: edeqa-pwa-react-demo, thewhiskytalks. Stored data, CRUD and
Android protocols are unchanged. Status: implemented; validation recorded below.

### Cursor groups

Decision: DatabaseGroupEntry is {key: group}, without value or id. Ordinary
records always have value, including when it is null or falsy. This replaces
DatabaseCursorGroupEntry and {key, value: {group}} headings. Renderers distinguish
records with 'value' in entry; The Whisky Talks Search is updated accordingly.

Keep once-per-lifetime synthetic headings and grouped source-block ordering.
Separating grouping from next() was rejected for this change because it requires
a new consumer API. Headings count as returned entries, do not consume data page
size, do not invoke handle and are absent from subscription events. Parent groups
are not inherited by sources. Pending headings and their internal ancestry remain
necessary to preserve nested groups when empty or duplicate-only blocks are
suppressed. Failed reads retain pending headings for retry.

The base next(n) validates, marks the cursor used and supplies the initial heading;
it does not advance count or position. Subclasses account for the entire returned
batch, including its heading. This removes counter rollback in built-in cursors;
custom subclasses that previously counted data only must adjust their accounting.

Affected consumers: thewhiskytalks; no stored data or Android protocol change.
Status: implemented; validation recorded below.

### Cursor state, subscriptions and errors

Decision: FirebaseCursor owns Firebase query continuation, scan bounds and buffers;
its generic count and position remain on DatabaseCursor. Remove proxy accessors
and redundant source path/options from Firebase pagination state. Ordered scan
key/value remain separate from the last returned key because filtering and async
handle can advance, replace or delete candidates.

Keep subscription metadata and counters by explicit user choice. Subscription id
is a getter over cursor.id. Independent subscriptions retain their deliveries and
counters; cleanup attempts every source even when one unsubscribe fails.

Reuse DatabaseBase.run at composition boundaries. Nested compositions propagate
already processed failures without invoking onError again; synchronous callbacks
during registration likewise propagate handler exceptions once. No new error
framework, compatibility adapter or custom cursor integration protocol is added.

Status: implemented; validation recorded below.

### Runtime DatabaseCursor and server database exports

Decision: replace the structural DatabaseCursor interface with a runtime class in
packages/database/src/common/DatabaseCursor.ts. It owns initial metadata and
protected counter/position fields. Base next validates arguments and supplies an
initial group heading; base subscribe validates the listener and returns undefined. Public
built-in cursors inherit it and compositions require instanceof, retaining
freshness, duplicate-instance and returned-entry checks. User cursors must extend
the constructor from their installed package and format. This supersedes accepting
structural implementations and the previous type-only export decision.

The main root and /database re-export the same class. The server archive adds
/database, /database/firebase and /database/local using the same database sources,
and an independent root entry preserving common exports plus DatabaseCursor.
Common stays independent of database. Server source boundaries include database,
the server root and the existing common forwarding entry, with firebase-key
external and declared in the server manifest/lockfile. No SDK adapter or automatic
Firebase initialization is added. Remove the custom declarations generator and
manifest types routes; public .d.ts publication is discontinued while source
TypeScript contracts remain.

Reason: simplify recognition and inheritance for user cursors and expose database
uniformly in the server archive. Separate installations and ESM/CommonJS builds
have separate class identities; callers must not mix their cursors. Grouping,
pagination, storage formats and Android protocols remain unchanged. Both web
consumers remain on story/move-database-to-module; custom cursors must migrate to
extends DatabaseCursor. Consumer sources and tracked tests are not changed here.
Status: implemented; framework/server builds and ESM/CommonJS database exports
and server root/database constructor identity validated.


### Pages cursor and inherited group headings

Decision: expose PagesCursor from redequate as a DatabaseCursor subclass over the
registered application pages. Use database-style field ordering and bounds rather
than PagesPagination's substring search; compute _sort_name from label/title. Keep
PagesPagination for existing consumers. Page cursors are read-only, with no handle,
date bounds or subscription override. The Whisky Talks Search is the motivating
consumer; consumer source is not changed here.

DatabaseCursor owns option getters and once-per-lifetime heading creation in
next(n); subclasses consume the initial array and account for all returned entries.
The base constructor optionally accepts a collection path for source identity;
heading keys use the configured group string. Composition filters empty or duplicate-only groups
after reading, retaining headings across failed reads. A grouped static cursor
can return a heading alone on its first exhausted read. This replaces preparing
headings separately in each implementation; a separate _completeNext helper and
passing batches into super.next were rejected. Stored formats and Android
protocols are unchanged. Both web consumers remain on story/move-database-to-module.

Status: cursor simplification validated on Node.js 24.21.0: 430 unit tests
(including 85 database/custom-cursor tests), 51 emulator integration tests,
strict database TypeScript checks, framework/server builds and ESM/CommonJS
database exports pass. Both web consumers build against the current framework;
The Whisky Talks Search consumes the new group-entry shape. Browser interaction
and production Firebase validation remain pending.

### Auth resolution dependencies

Decision: resolveAuth accepts an options object as its second argument and passes
it only to the lazy default LocalAuth constructor. Existing Auth instances are
returned unchanged. Dispatcher supplies the resolved database, without UserData.
LocalAuth and FirebaseAuth accept UserData through their constructors, defaulting
to the neutral common model; they retain it privately and pass it as an argument
to internal helpers. Post-construction injection through _UserData is removed.

Both web consumers explicitly construct FirebaseAuth with firebase, database and
the web UserData model. This keeps model selection with the application and avoids
mutating provider internals during resolution. Stored data and Android contracts
are unchanged. Status: all 91 Auth unit tests pass, including constructor models
for sign-in, session restoration, subscriptions and anonymous users. Framework
ESM/CommonJS and both web consumer production builds pass. Authenticated browser
validation remains manual.


### Shared Auth profile persistence

Decision: AuthBase owns saveProfile, updateProfile({public, role, private}) for the
current user. Provider implementations call the internal loadUserData helper
for database loading; the redundant public resolveUser wrapper is removed.
resolveCurrentUser remains the current-session API. LocalAuth registration
(including newly simulated provider accounts) and Firebase email/password
registration save their initial public profile before returning. Supplied fields
are updated through a root-relative database batch at users_public/<uid>,
roles/<uid> and users_private/<uid>; omitted fields are retained. Default null
roles and empty private sections are not registration writes, so ordinary signup
does not require permission to write protected roles. Passwords/session records
remain provider-owned. Firebase SDK profile updates and local account profile
updates are replaced by database writes; EditProfile uses the section-based API.

Reason: creating an Auth account alone did not create its application profile.
Both web consumers use the shared framework path. Stored profile paths and
Android record formats are unchanged; direct callers of updateProfile must adopt
the section-based argument. Registration needs an operational database; the
current LocalDatabase class remains a stub and is not expanded in this change.
A Firebase account can exist after a profile write fails; cross-service rollback
is not attempted. Password registration now persists the profile immediately,
so later web login sees persisted=true rather than treating that profile as new.
Status: 102 Auth unit tests and all 51 emulator integration tests pass. Framework
ESM/CommonJS and both web consumer production builds pass. Real authenticated
browser validation remains manual.


### Local login resolves the installed current user

Decision: LocalAuth login saves the initial profile, silently installs the local
session and calls resolveCurrentUser({skipDelay: true}) for its return value.
Success emits the same-window auth event after database loading. Failure restores
the exact previous stored document (including an absent key) only while the pending
state is unchanged; later logout/login writes are preserved. The internal option
avoids a second simulated delay; ordinary resolveCurrentUser() retains its delay.
Storage events in other tabs can expose the intermediate write; this is not an
atomic transaction across localStorage and database. Auth/database record formats
and web consumer call sites are unchanged. Status: all 104 Auth unit tests pass,
including rollback, concurrent session changes and single-delay behavior.


### Auth contract in TypeScript and common helpers

Decision: keep AuthBase.ts at packages/auth/src with its interfaces and type
aliases in that same file. Type database, profile sections, provider/email options,
callbacks, unsubscribe and Promise results. AuthBase guarantees the UserData
contract; custom model constructors remain supported at runtime. Generic standalone
interfaces remain available, but the base class itself is not generic: its default
constructor cannot guarantee an arbitrary subtype. Shared construction is now
owned by AuthBase, as described below. Move resolveAuth, loadUserData and
saveUserData into src/common;
provider implementations and helpers remain JavaScript. Public entry paths,
lazy default Auth and runtime behavior are unchanged. Declaration generation and
mandatory type checking remain separate work.

Status: all 104 Auth unit tests and the framework build pass. Native ESM/CommonJS
checks verify AuthBase exports, provider inheritance identity and lazy resolution.


### AuthBase supermethod validation

Decision: built-in providers call super(options) for database/model configuration
and call super.method(...) at the start of each operation needing argument checks.
Those supermethods validate synchronously and throw on failure; provider logic
continues in the calling implementation. Protected operation-dispatch hooks were
rejected. AuthImplementation in AuthBase.ts describes the async provider contract,
while validation-only supermethods return void. Shared createUserData and
saveProfile remain on the base; profile loading, current-profile saving and
subscription delivery use functions in src/common. Local subscriptions alone
suppress duplicate states. Source errors invalidate pending profile delivery.

Shared checks cover string types, provider/credential shape, known options,
callbacks, configuration and profile sections before provider effects. Email
normalization and password rules remain provider-owned; SDK failures pass through.
Local delays follow shared validation. Local session installation/rollback and
Firebase account/profile ordering remain provider-specific. Structural external
instances, profile paths and Android contracts are unchanged.
Status: all 179 Auth unit tests and 51 emulator integration tests pass. Framework
ESM/CommonJS exports, inheritance, lazy resolution and validation checks pass;
both web consumers build successfully. Mandatory type checking remains separate
work; authenticated browser validation remains manual.

### Shared Auth construction and local IndexedDB persistence

Decision: AuthBase owns UserData defaults and identifier validation; internal class
methods use an underscore prefix. Provider operations call synchronous supermethods
for validation. Registration, profile updates and email verification require an
injected database before provider effects; saving is never silently skipped.

LocalAuth now uses IndexedDB `redequate:local` with namespaced auth_accounts,
auth_state, auth_links and auth_mail stores, all with string key paths. Account
key is also UserData.id and the injected profile database's user identifier.
Transactions guard writes and login rollback by revision. Same-window events and
BroadcastChannel notify observers after successful writes; broadcasts carry only
namespace and revision. Auth and profile storage are not one atomic transaction.
Old localStorage data is neither migrated nor touched. LocalDatabase remains a
stub; Storage and Backend keep separate databases. Web API/profile paths and
Android formats remain unchanged; existing local browser test sessions reset.
Status: 194 Auth unit tests and 51 emulator integration tests pass. Framework and
both web consumers build; ESM/CommonJS imports, inheritance, lazy resolution and
database guards pass. Authenticated browser validation remains manual.

### LocalDatabase IndexedDB helpers

Decision: shared IndexedDB `redequate:local` version 2 adds `database_records`
with compound keyPath [namespace, key]. Namespace is LocalDatabase.storageKey;
key is an exact string. The common schema owner preserves Auth stores, records
and indexes when upgrading from version 1 and creates missing stores/indexes.

Local helpers expose openDatabase, getRecord, addRecord, putRecord and deleteRecord.
Reads return the stored value or undefined; add rejects duplicate keys, put
creates/replaces, and deleting an absent record succeeds. CRUD helpers close
connections after each operation and resolve only after transaction completion.
Path/tree semantics, listeners and cursors remain future provider work;
LocalDatabase methods still delegate to DatabaseBase. Public web and Android
interfaces are unchanged.

Status: all 207 tests across Auth and LocalDatabase helpers pass on Node 24.21.0,
including version 1 migration, namespace isolation, conflicts and transaction aborts.

### Named database path segments

Decision: DatabasePath arrays accept named segments containing exactly one
string-valued field, for example ["users_public", {uid: "u123"}, "email"]. The
shared parser validates and copies segments while preserving field names for
future Local queries; local/helpers reexports it. Firebase substitutes each
named segment's value, so this example retains users_public/u123/email behavior
for reads, writes, drafts, updates (including Map batches), deletes and listeners.

Cursor arrays starting with a string are paths; arrays of source descriptions
or ready cursors remain compositions. Source descriptions can contain named
paths. Normalized cursor identity uses segment values so equivalent Firebase
paths deduplicate. DatabaseFieldPath keeps orderBy limited to strings/string
arrays. Local CRUD and schema are unchanged; LocalDatabase remains a stub.

Affected consumers: demo and The Whisky Talks both have corresponding
story/move-database-to-module branches. Existing paths, returned data and Android
formats are unchanged; this is an additive JavaScript path representation.
Status: all 310 database/Auth unit tests pass on Node 24.21.0, including named
paths across Firebase operations, validation, composition and deduplication.

Local CRUD helpers now also accept DatabasePath, validate it before opening
IndexedDB and join segment values with '/' into the existing exact record key.
Strings remain unchanged, including repeated/leading/trailing slashes. Named
segments do not yet perform field queries or select physical stores. Schema,
namespace isolation and transaction behavior are unchanged. All 320 database/Auth
unit tests pass on Node 24.21.0.

### Internal database paths use named identity segments

Decision: migrate frontend and Auth database calls, nested identities and Map
batch keys to named segments. Collection/property names and service nodes stay
strings. User identity is uid; private device maps use deviceId. Consumer rules
and Functions trigger paths establish chatId, alertId, tagId, tagKey (for _tag),
postId, extraId, typeId and mutualId. In mutualstamps the recipient map is keyed
by uid, including the _my branch. Mutual record keys are mutualId rather than
the record's id field, which identifies its target.

Do not infer a field from a local variable alone. Unresolved identities use the
literal property UNKNOWN with their original value. Review these nine segments:
- src/components/NewPostComponent/NewPostComponent.js: the edit draft,
  images update and text update use a configurable collection type (three sites).
- src/components/PostComponent/PostData.js: delete/fetch use configurable type;
  fetchCounters uses a counter key; _updateVal receives an opaque relative key
  (four sites). _updateVal preserves its original string cache address.
- src/pages/admin/audit/ErrorItemComponent.js: both error deletion paths lack a
  declared identity field (two sites).

Old join('/') paths in counterControl and FirebasePagination are explicitly
excluded. Firebase addresses, operation values and Android formats are unchanged.
Auth's private-field batch builder preserves named device segments recursively;
test database fixtures accept both legacy and named representations.

Validation: a temporary AST comparison verifies the 104 named segments across
20 changed frontend files unwrap to their original expressions and operations;
the dynamic _updateVal address is equivalent by construction. All 592 unit tests
pass on Node 24.21.0 after adapting fixtures and expected path arguments.

### Consolidated database path normalization

Decision: Firebase owns normalizePath and its named-segment validation and
slash-path conversion. Firebase's resolvePath preserves exact slashes and still
permits undefined; Firebase cursor paths retain their normalized string form.
Cursor entry points distinguish paths from cursor source lists by their
argument's first array element. Common cursors retain structural path arrays,
and Local IndexedDB interprets named segments structurally in its own path helper. Earlier parser
references above describe the superseded implementation.

### Database identity names follow consumer rules

Decision: named path properties use wildcard names from The Whisky Talks'
database.rules.json verbatim, without '$'. These supersede the camelCase/uid
identity names in the earlier migration entry:
- users_public, users_private, roles, alerts and _chats user keys: user_id.
- chats and _chats chat keys: chat_id; posts keys: post_id; tag keys: tag_id.
- mutual, mutualrequests and mutualstamps type keys: type_id (explicit user override
  of the rules wildcard mutual_type).
- mutual and mutualrequests record keys: mutual_id (not the record's id field).
- mutualstamps recipient keys, including _my, and chat member keys: user_id.

roles/user_id is established by rules' roles/auth.uid lookup; member and _my
identities are confirmed by their writers. All named path properties use
snake_case, including device_id, alert_id, extra_id and _tag/tag_key from
models/trigger paths where rules provide no alternative. Local variable names,
record fields and other API parameters retain their existing spelling.
The existing nine UNKNOWN segments remain unresolved. Indexed child fields uid
and id retain their names: they do not name wildcard keys. In particular alert
record.uid identifies the author, while alerts/user_id identifies the recipient.
Renaming changes path metadata only; segment values and Firebase addresses stay
the same. Old join('/') exclusions remain in force.

Pending checks explicitly deferred by the user; remind them when reporting this
change, and check these separately before changing their behavior:
- src/chat/ChatMeta.js, watchOnline: the current subscription omits chat_id
  between chats and !meta. Compare with watch/updateVisit and consumer rules.
- src/components/MutualComponent/MutualList.js, REQUESTS: verify querying the
  mutualrequests/type_id collection instead of descending into mutual_id
  before filtering its children by id.

### Database path follow-up audit

The later full-path audit resolved the two deferred checks above. ChatMeta's
online listener now includes chat_id, matching updateVisit and the chat member
rules. MutualList REQUESTS now queries mutualrequests/type_id and filters its
immediate request records by their id field; the production trigger confirms the
request key is a separate mutual_id. These changes alter the previously incorrect
subscription/query addresses to match the writers.

The audit also found two `_counters` calls in counterControl whose `path` can
represent either a post key or a slash-delimited composite address. It joins array
inputs as before and uses a named UNKNOWN segment for database reads/listeners;
the direct Firebase transaction retains its original string child path. Configurable
`type` record keys in NewPostComponent and PostData, and `_counters` keys in
PostData, use UNKNOWN instead of inferring `${type}_id`. Errors record keys also
use UNKNOWN because the consumer rules declare no wildcard. UNKNOWN changes only
the in-memory path metadata; Firebase receives the same addresses. Opaque relative
keys in PostData retain their exact slash-delimited values. The exact names can be
resolved only after those key schemes are specified in the consumers.

Read-only consumer check: both demo and The Whisky Talks have matching
story/move-database-to-module branches. Demo has no additional named database
identity calls in its src tree; its maintenance page uses raw Firebase paths.
The Whisky Talks has legacy unnamed segments in Contacts (chat_id),
ProfileWithFriends (composite `_counters` key), FirebaseUpdate (two `_counters`
schemes), Groups/Profile (dynamic collection and key), and CounterComponent
(composite counter path). Its NewsFabComponent forwards a path prop and its
maintenance page uses raw Firebase strings. Consumer code was not edited because
it is outside the repository write allowlist. Raw Firebase addresses remain
compatible; these sites need local annotations or named paths when consumer edits
are permitted.

### Shared email options without social-login changes

Decision: Auth providers share email-option preparation. Explicit defined values
override defaults; email-link defaults remain /signup/<email> on the current
origin with handleCodeInApp=true. Firebase now forwards verification/reset/link
options to its SDK; Local records url and handleCodeInApp in simulated mail.
SDK validation remains authoritative for Firebase-specific requirements.
Social-login handling and One Tap are excluded. Repeated profile loading in Login
and Dispatcher is deferred because those paths also serve social login. storageKey
and its validation remain LocalAuth-owned. Public signatures and profile paths
are unchanged; callers that previously supplied ignored email options now receive
the SDK's handling of those options.
Status: 200 Auth unit tests and 51 emulator integration tests pass; framework and
both web consumer production builds pass.

### Local IndexedDB dynamic segment fields

Local `DatabasePath` uses `{friendship: "m123", _: true}` for a single
dynamic named segment; `_: true` is exactly equivalent to `_: 0`. Paths with
multiple dynamic levels use numeric markers, such as `{friendship: "m123", _: 0}`
and `{active: "a456", _: 1}`. In the `records`
object store, these segments become `_key0: "friendship", _value0: "m123"`
and `_key1: "active", _value1: "a456"`. `_key` without a numeric suffix
remains the serialized record identity and, with `_collection`, forms the
object store primary key. `_keyN` names a dynamic segment; `_valueN` holds
its value. The `id` returned by type queries is the value at the highest
dynamic level.

Indexes are `_key0` on `[_collection, _key0]`, `_key1` on
`[_collection, _key1]`, and `_key0_key1` on
`[_collection, _key0, _key1]`. Local type queries use `_keyN` conditions;
a string type query means `_key0`. This physical schema replaces the earlier
`_typeN`/`_idN` fields and indexes. Existing Local IndexedDB databases are
not migrated. Firebase omits `_` when normalizing a path, so its
addresses remain unchanged.

### LocalDatabase public CRUD

LocalDatabase uses the IndexedDB record helpers for draft creation, exact
record and top-level field reads/writes/deletes, and top-level update merges.
`_: true` and `_: 0` address the same record; numeric levels address nested
identities. Absent reads return undefined and deletes succeed. The provider
uses DatabaseBase's per-operation error handling and rejects read queries and
batch updates until those behaviors have a concrete Local implementation.
Listeners and cursors remain unsupported. Existing Firebase paths and Android
data formats are unchanged. Public CRUD is covered by fake-IndexedDB tests;
consumer browser validation remains outstanding.

### LocalDatabase public listeners

LocalDatabase now implements DatabaseBase's existing addEventListener contract
for value and child add/change/remove callbacks. A namespace-scoped operation
queue orders initial snapshots and successful LocalDatabase CRUD notifications;
each listener has an independent remove handle. IndexedDB remains the source
of truth, while a local dispatcher delivers notifications to instances sharing
the same storageKey in this JavaScript context. Child additions follow the
Firebase adapter's last-child query, including an existing last child at
registration and a new child entering that result. Errors use DatabaseBase's
callback and subscription contexts. Local range cursors remain separate work.
Cross-context listeners share one BroadcastChannel per storageKey and JavaScript
context while subscribed. Writes publish changed paths only after IndexedDB
commit; receivers filter subscriptions and reread IndexedDB without
rebroadcasting. Firebase paths and persisted record formats are unchanged.

### Local creation time and atomic updates

LocalDatabase resolves its own timestamp and increment markers at write time,
including nested values and draft saves. These markers do not use Firebase's
server-value format. Increment uses zero when the previous value is not numeric;
the `TIMESTAMP` marker resolves to epoch milliseconds. LocalDatabase never adds
a `timestamp` field implicitly. Caller-supplied timestamps and markers remain
explicit values. Whole-record replacements retain only fields supplied by the caller;
merge updates preserve existing fields. Records without an explicit timestamp
are not backfilled, including collection writes and draft saves.

New IndexedDB databases use schema version 1 without `_updatedAt` or its index.
Existing version 2 or 3 databases require caller deletion before opening the
version 1 schema. LocalDatabase removes `_updatedAt` from rows it writes.

Local batch update accepts Map DatabasePath keys and root-relative string keys.
String keys address a record by its existing path values, reject ambiguous
matches, and use a dynamic `id` identity for a new record. All entries are
validated and applied within one IndexedDB readwrite transaction, with one
listener refresh after commit. Overlapping record and field paths reject the
batch. Firebase payloads, web consumer API signatures and Android data
contracts are unchanged.

### Direct Firebase path resolution

Firebase uses one resolvePath function in firebase/resolvePath.ts, imported
directly by operations and cursors. The normalizePath name, common.js wrapper
and preserveSlashes option are removed. Resolution always joins named segment
values and normalizes empty slash components. Undefined/null paths reject;
createCursorQuery skips resolution when orderBy is absent.

The _ property is Local metadata and is entirely ignored by Firebase, including
its value and validation. Each object segment still requires exactly one other
named string value. Local marker semantics remain Local-owned. All 633 unit
tests pass on Node 24.21.0, including arbitrary _ metadata and cursor coverage.

### Database contracts separated from the base class

DatabaseTypes.ts owns all 22 database interfaces and aliases. It imports only
DatabaseOrder through import type. DatabaseBase, cursors, Firebase resolvePath,
Auth and PagesCursor import contracts directly from that module, removing the
DatabaseCursor -> DatabaseBase source dependency. DatabaseBase retains explicit
type reexports and its existing runtime class/enum exports for compatibility.
Definitions and behavior are unchanged. Comments retain non-obvious contract
rules and omit descriptions already expressed by names and signatures.
All 633 unit tests pass on Node 24.21.0.

### orderBy uses DatabasePath segments

DatabaseFieldPath aliases DatabasePath for cursor, read and listener options.
DatabaseCursor validates and preserves orderBy without splitting strings on '/'.
Firebase resolves it through resolvePath before SDK calls. PagesCursor and Local
listeners treat a string as one field name and arrays as ready field segments;
named segments contribute their string value and _ metadata is ignored. Nested
fields should be supplied as arrays. Local read queries remain unsupported.
Tests cover named segments, inclusive cursor bounds, Firebase read/listen queries,
Pages sorting and initial/live Local child ordering.

### Shared path validation

common/validatePath validates path and orderBy without converting or mutating
them. Strings and arrays of strings/named segments are supported; '' and []
mean root, while empty array segments and empty named values reject. Objects
have one non-empty string-valued name besides ignored _ metadata.
DatabaseCursor, Firebase resolvePath, Local helpers and Local subscriptions use
this validator. Local retains collection requirements, dynamic-level checks
and fixed-condition conflict checks. String wildcard listener paths validate
their split segments before creating internal wildcard descriptors.

An explicit root orderBy selects whole values: Firebase uses orderByValue and
Pages/Local access the complete value. Omitted orderBy retains prior behavior.
The earlier empty named-value normalization in Firebase is superseded: malformed
segments now reject consistently before execution.

### Transactional database updates and ordered-field eligibility

`update(path, callback)` atomically replaces the value and returns its final value
in Firebase and Local. The synchronous callback receives null for absent data;
null and undefined both delete. Firebase may retry the callback, so side
effects and asynchronous work belong outside it. Callback updates require Firebase
read and write permissions; object merges and root-relative batches retain their
existing contracts and do not accept callback values. Counter consumers receive
plain values rather than Firebase TransactionResult objects. No stored path or
Android data-format change is introduced.

Cursors with a non-empty orderBy exclude entries missing that field before handle
and continue scanning to fill pages. Subscriptions report field appearance as add
and disappearance as remove. Root orderBy still selects whole values; Local range
cursors remain unsupported. Web consumers using optional sort fields now receive
only entries containing them.


### Firebase creation permission history

The prior set-based create permitted write-only paths. The unified CRUD contract
supersedes that behavior: Firebase creation uses a transaction for atomic conflict
rejection and therefore requires read and write permission at the target path.
Firebase paths and Android data formats are unchanged.

### Shared effective paths and Local collection aliases

common/resolvePath.ts now owns the canonical slash address used by Firebase SDK
operations and composed-cursor source identity. It resolves named segment values
and ignores _ metadata. Composition deduplication now treats equivalent string,
array and named paths as the same source address, superseding structural path
serialization for custom cursors. Sources without a path still use their cursor ID.

Local accepts a named first segment only when its value is posts or replies.
The property name does not add a condition: [{type: "posts"}, ...] addresses
exactly the same data as ["posts", ...]. Local's resolveCollectionPath retains
this allowlist and preserves all subsequent identity metadata; CRUD, drafts,
batches, type queries and local/cross-context notifications share that rule.
String collection names retain their existing scope. No IndexedDB migration or
Firebase/Android stored-path change is required; Local range cursors remain
unsupported.

### Dedicated Local stores from the collection registry

local/constants.js owns LOCAL_COLLECTIONS (posts/replies, each with its own store
and post_id identity), the fallback records store and the shared keyPath/index
schema. Local helpers use this registry for named-root validation, generated
identities and store routing; callers do not select storage-specific key fields.
This supersedes storing posts and replies in the common records store. Other
string collections and nested draft identity rules retain their existing behavior.

New databases create posts, replies and records with the same compound keys and
indexes. No explicit IndexedDB version is supplied or raised, per the user's
instruction. Existing databases remain unchanged: legacy posts/replies rows in
records are neither moved nor deleted, and aggregate reads exclude them. A legacy
database without the new stores cannot serve operations targeting those stores;
there is no automatic fallback or reset.

Multi-store batches commit in one IndexedDB transaction and notify only after
success. Subscription snapshots aggregate routed stores, including cross-context
notifications. Firebase behavior, API paths and Android data formats are unchanged.

### Local subtree replacement

Local delete removes the addressed value and all separately stored descendants.
Ordinary writes and batch replacements remove omitted descendants; object updates
replace only supplied field subtrees. Existing named child identities are retained
when explicitly included. New nested JSON stays inline: its shape alone does not
establish a collection. Callback updates retain their existing replacement rules.

Local batches reject overlapping normalized addresses before writing, including
record/field ancestors and descendants. Distinct named identities remain distinct.
These changes align Local replacement behavior with Firebase without changing
Firebase paths, Android data formats or the IndexedDB schema/version.

### Generated record identity

Generic Local create uses the named field id at the next dynamic _ level.
Frontend paths to generated tags, extras, errors, alerts and chats use id at level
0; mutual/request records use level 1 after their dynamic type segment. This
supersedes the collection-specific wildcard names for those generated keys.
Posts/replies retain the registry's post_id exception. User/device identities
remain explicit, and ordinary profile fields are string segments. Public profile
updates include updated once, avoiding overlapping Local batch addresses.
Firebase resolves the same segment values, so stored addresses and Android data
formats remain unchanged. No IndexedDB version change or migration is introduced.

### Local conditions and field aliases

Named segments without _ now select direct row fields; Local no longer writes or
queries an _conditions wrapper. Their order does not create a different record.
_key remains an internal row locator and a structural trace for subtree assembly,
not the source of truth for matching conditions. Older traces can supply missing
selector metadata in memory without a database migration or automatic rewrite.
Fixed conditions cannot overwrite the row's internal _collection, _key, value,
_keyN or _valueN fields; these names remain usable inside the stored payload.

At a field position, "email" and {email: "email"} address the same field.
Payload field names have direct selector markers beside value, so UserData uses
{[x]: x} for public/private saves. Ordinary {email: email} conditions remain valid
without requiring the name and value to match. This supersedes the earlier
restriction to string profile fields. Parent reads assemble separately stored
descendants; writing/deleting a descendant clears its embedded ancestor copy.
CRUD, batches, callback updates, type queries and subscriptions share these rules.
Generic id levels, the posts/replies registry exception, Firebase addresses and
Android formats are unchanged. No IndexedDB version bump or migration is added.

### Unified database CRUD contract (supersedes earlier create/write and undefined decisions)

`create([collection, keyField], record)` allocates and writes in one operation,
returning the permanent key. `create([collection, {[keyField]: id}], record)`
creates with that ID. A synchronous callback may compute the record from the
permanent key. A duplicate key fails without overwriting data. Firebase uses a
transaction, so creation requires read and write permission at the target path.
Local uses an IndexedDB readwrite transaction; failed writes roll back allocation.
The public create signature accepts `DatabasePath`; create-specific path shape
is checked at runtime, without a separate create path type or options argument.
The named updater type was removed; update callback signatures appear directly
at their use sites. Create keys use `string` directly in the callback and return
types, without a named key type. `DatabaseErrorHandler`, `DatabaseQueryValue`,
`DatabaseCursorPosition`, `DatabaseCursorEvent`, and `DatabaseGroupEntry` remain
public types.

`update(path, object)` keeps the existing partial merge and missing-record behavior. `update(path, current => value)` replaces the complete value atomically. The callback may run more than once under Firebase contention, must be synchronous, and both null and undefined delete. Batch updates retain their existing path/value semantics; callbacks are only supported on the single-path overload. `delete(path)` remains explicit. `write` is removed from the public database API. Web callers use callback update for replacement and object update for merge. Firebase and Local path mapping, and the stored data format used by Android, remain unchanged.

Superseded by **Read identity-field contract restored** below: the previous
literal trailing-string read rule contradicted the agreed provider-neutral path
model. It must not guide new call sites or tests.

`read([])` rejects with `database/invalid-argument`; root listing is outside the read contract. Query options filter immediate children of the exact path, including record paths. Without `orderBy`, `equalTo` compares complete child values, while `start` and `end` are inclusive key bounds. `orderBy: ""` explicitly orders by child values; a non-empty `orderBy` compares that child field. `equalTo` cannot be combined with `start` or `end`, and `order` accepts only `asc` or `desc`. Reads return ordinary values or objects without a traversal-order guarantee; use the Cursor API for ordered iteration. Firebase's integer-key ordering is used for key bounds in both backends.

### Firebase child addition boundary and chat message watch

Firebase `addEventListener` registers the initial `value` listener before its
unbounded `child_added` listener. It buffers child events until the first value
callback and then emits only keys greater than the greatest key in that value
snapshot, using Firebase key order. An event received early for a key absent
from the snapshot is emitted if it exceeds the boundary. A write made after the
API call but included in the first value snapshot is baseline and is not emitted,
even if its child event was buffered. Registration order alone cannot distinguish
that write from preexisting data, so the API does not guarantee every write after
the call is reported. Keys inserted below the initial maximum also do not produce
`onChildAdd` notifications.

`ChatMeta.watch` obtains the latest existing message with a one-entry descending
`created` cursor, subscribes to child additions and changes, and buffers events
while that cursor resolves. It ignores duplicate and older message events so an
older edit cannot lower the latest timestamp. The subscription and cursor are
independent reads; a write included in the listener baseline is covered by the
cursor only when its snapshot sees that write. There is no atomic cross-query
snapshot or guarantee for an insertion below the initial maximum key. Consumers
that require a lossless stream need a server-side sequence or another atomic
handoff protocol.

### Local database cursor

LocalDatabase now uses the shared cursor composition contract and an atomic Local
cursor. Each page reads the selected collection from IndexedDB, applies Firebase
key ordering (including signed integer keys), field or value ordering, inclusive
bounds, date-key filtering, and a strict continuation tuple. Keys processed by
this cursor are retained for its lifetime to prevent replay after an edit moves
them later in sort order. Handlers run sequentially on copies and write through
the existing storage-key mutation queue. Subscription baselines and subsequent
refreshes use that same queue and BroadcastChannel dispatcher; each subscription
diffs only its query result and reports add, change, and remove transitions after
the initial snapshot. A cursor subscription reads its collection store rather than
all Local stores.

As with Firebase, paging is not a transaction spanning calls: concurrent changes
that move an unvisited entry before the continuation can omit that entry. Local
collection reads still materialize their store because the current IndexedDB
schema has no index for arbitrary `orderBy` fields. Root cursor paths assemble
values across collection stores and consequently require a full database read.
No stored format or external cursor API changed.

#### Indexed local cursor pages

Schema version 3 adds Firebase key-order and top-level `created` indexes to each
Local store and backfills existing rows during the upgrade. Key ordering encodes
integer keys numerically, then other keys lexically. `created` uses Firebase's
null, boolean, number, string order and the encoded key to break ties. Each page
uses a short read-only IndexedDB cursor transaction and resumes after the last
index value and key. Direct child handler writes use the stored row identity.

Nested rows require subtree assembly, so their collection uses the materializing
comparator path. Arbitrary `orderBy` fields, value ordering, complex `created`
values, and `created` queries combined with date-key bounds also use that path:
the available indexes cannot reproduce their complete Firebase ordering. Key
queries apply date-key bounds through the key index. A database with a newer
schema version remains readable; it uses the comparator path if these indexes
are absent. Subscriptions still rebuild their query result on notification.

### Local IndexedDB physical roots and scoped cursor indexes

Decision (supersedes the earlier `records` fallback and schema-v3 cursor notes):
`LocalDatabase` opens `redequate:local:${storageKey}` at version **1**. The first
path segment is always the physical object-store name. A new database creates
only the active roots listed in `LOCAL_COLLECTIONS`; unknown roots fail path
validation, and the obsolete follow/watch and underscored test roots have no
stores. Existing version-2 or version-3 local databases must be deleted before
opening this version-1 schema. There is no upgrade, backfill, or legacy row copy.
A version-1 database created under an older schema must likewise be deleted.

Rows keep the full serialized nested path as their primary identity. Indexed
cursor projections add Firebase-compatible integer-key order and compound scope,
field and child-key order for chat messages (`chat_id`/`created`), user chat lists
(`user_id`/`timestamp`), alerts (`user_id`/key or `timestamp`), recipient-filtered
posts and replies, and the top-level fields used by users, tags and activity.
A cursor page uses a new short read-only IndexedDB transaction and resumes by
its complete index tuple, including the serialized path to distinguish ties.
Direct indexed child handler writes use that exact stored path. Queries whose
structure or value order is not represented by an index retain the comparator
path, as do subscriptions that rebuild query results after notifications.
Firebase paths and the Android wire format are unchanged. Validate framework
changes against the demo and production web consumers before merging.

The provider-neutral behavioral contract and shared Firebase/Local scenarios are
in `packages/database/src/common/CONTRACT.md`. Emulator-only cases are kept in
the integration suite and must run before treating its unresolved Firebase
edge cases as verified.

### Local generated keys and timestamp ranges

Decision (supersedes the version-1 Local schema and date-key notes above): Local
opens schema version **2**. It upgrades version-1 databases in place, adding one
out-of-line, auto-increment allocator object store per physical root and the
top-level timestamp cursor indexes. The allocator and record store participate
in one readwrite transaction for generated creates. IndexedDB assigns a numeric
key during `create`; the callback receives its decimal string synchronously before
the record is written, and an abort rolls back both the record and key generator.
All logical collections beneath one root share that sequence. Supplied keys
remain valid, and Firebase retains its own push-key behavior. `create` resolves with the permanent key after commit.

Local `startDate` and `endDate` now compare the record's explicit `timestamp`
field in milliseconds. Missing or invalid timestamps do not match. The field's
index supports timestamp ordering and date ranges where the scoped cursor index
is available; other orderings filter candidates while retaining their own
ordering and pagination rules. Firebase continues using push-key date bounds.
Version-2 databases with an incompatible schema and databases newer than version
2 are rejected.


### Final Database/Cursor parity and native Local allocation

Decision (supersedes the schema-v2 allocator/migration decision above): Local
opens IndexedDB at version **1**, with exactly the active physical path roots.
Each root has native `autoIncrement` on the internal `_rowId` primary key and a
unique compound `[_collection, _key]` logical identity index. No allocator stores,
backfill, migration, or automatic deletion are provided. Existing incompatible
v1/v2 databases require explicit removal. Numeric generated IDs and synchronous
create callbacks remain transactional; insertion failure rolls back allocation.
Supplied numeric IDs advance the native generator when their slot is free;
logical identities sharing a supplied ID retain distinct physical rows.

Both atomic cursors can revisit entries moved beyond their captured sort tuple;
handlers execute before public composition deduplication. Local no longer hides
those handler revisits. Objects and arrays have equal ordering rank and tie by
Firebase child key. Firebase SDK rejects object query endpoints, so object-boundary
continuation uses original-query tuple filtering. Scalar Local index pages retain
native cursor transactions and point handler writes via the unique identity index.
Null equality remains explicit; missing/null ordered fields are excluded by cursors
but included by null-equality reads. Local listener removal is idempotent.

Additional compound indexes are based on current web call sites: mutual/request
`uid_id`, private chat lookup, users' visit/email verification, tag id/label/hidden,
extra id/id_uid, and error uid. Existing chat, alert, recipient and activity indexes
are retained. Tests compare indexed queries with nested comparator fallback and
observe both IDBObjectStore.getAll and IDBIndex.getAll. Unsupported/deep queries
continue to use fallback. Firebase URLs and Android data formats do not change.
Date ranges retain Firebase push-key time versus Local explicit timestamp semantics.

Firebase Emulator runs with local Node 24.21.0 and Java 17 outside the sandbox;
sandbox loopback binding returns EPERM. The shared fixture uses the permitted
`database_test` path. Subscription handles are independent but expose their owning
cursor ID. Existing Chat implementation is preserved: its 11 baseline unit test
failures require a separate, narrowly scoped fix. No prop-types dependency is added.


### Read identity-field contract restored

Decision: in `read` array paths of at least two segments, a final string is the
identity field, never a literal branch. Firebase removes it and queries its parent;
Local collects records with that identity field (fixed or dynamic), keyed by its
values, including descendants. Thus `["users_public", "user_id"]` reads users,
and `["users_public", {user_id: uid}]` selects one user and its subtree.
A concrete branch/field uses a named segment, e.g. `["meta", {settings: "settings"}]`
or `["users_public", {user_id: uid}, {email: "email"}]`. Local resolves these against
existing literal/embedded storage without migration. Strings remain exact raw
paths; single-root arrays continue to read the collection.

Cursor now follows the same trailing-string rule for array paths of at least two
segments. Firebase queries the parent and uses each child snapshot key. Local
selects immediate records with the specified stored identity field, uses their
stored keys, and applies the same selection to indexed pages and subscriptions.
The cursor's exposed path is the resolved parent path. String cursor paths remain
literal, and a concrete array branch must use a named segment such as
`["meta", {settings: "settings"}]`. **Breaking change:** an older cursor array
such as `["meta", "settings"]` no longer visits the literal `settings` branch;
use `"meta/settings"` or the named segment instead. create/update/delete/listener
paths and orderBy normalization retain their own semantics. PostData.fetchExtras deliberately
keeps `["extra", "extra_id"]`: Firebase must query `/extra`, whose id_uid index
already exists in both consumers' local rules, never `/extra/extra_id`.
Local does not silently merge conflicting child identities when assembling a
collection. Named selectors match the corresponding dynamic identity as well.

Framework scalar reads and The Whisky Talks Contacts/Groups/Profile read paths
use explicit named segments. ChatMeta changes are restricted to four read path
arguments; ChatList, subscriptions and pagination are not rewritten. Firebase
URLs for correctly expressed reads and Android wire formats remain unchanged.
No prop-types or new schema/store/index migration is introduced by this correction.
The shared emulator/Local contract covers identity collection reads, queries,
record subtrees, concrete fields and the exact extras regression.

### Lazy list cursor lifetime and loading latency

Decision: retain LazyListComponent's existing `cursor` prop. List owners create
cursors during render without memoization, revision counters, or list caching.
Explicit refresh uses the existing Layout.REFRESH action to remount the routed
page tree. Mount/unmount effects and query-filter changes do not dispatch refresh
or reset actions: navigation and ordinary renders already create fresh cursors.
The legacy list action constants remain available, but do not reset database
cursors or keep revision state. No createCursor factory API is introduced.
Previously loaded rows are not retained across unmounts. Chat is not changed.

LazyList rearms its observer after each successfully processed page, including a
page whose transformations all return null. Pages still render together in cursor
order. Post enrichment starts independent counters, extras and author reads in
parallel after reading the post. Counter/extra read failures reject their promises
instead of leaving a page pending indefinitely. The Whisky Talks Profile supplies
the existing backend dependency to the post transformation's repair handler.

Database/Cursor contracts, IndexedDB layout, Android formats and Chat source files
are unchanged. No prop-types is added. Validation: 882 unit tests, 871 passed and
11 existing Chat failures; Firebase Emulator integration 86/86 passed. Actual
production network timings have not been measured.

### October 2026 dependency refresh across the web consumers

Decision: update Redequate, edeqa-pwa-react-demo and thewhiskytalks together on
Node.js 24.21.0. Use React/React DOM 19.3.1, Firebase 13.1.0, MUI 9.5.0,
Uppy Core 6.3.0 and Dashboard/Webcam 6.0.2, i18next 26.5.4 and react-i18next
17.1.0. Keep the existing script that shares React and i18next instances across
local consumer installations. Whisky retains MUI Styles, updated to 6.5.0.

Tooling updates include Firebase CLI 15.34.1, cross-env 10.1.0, gh-pages 6.3.0,
jsdom 30.1.3, postcss-nested 9.0.1, PostCSS 8.5.31, Rollup 4.64.12, Vite
8.3.5 and Vitest 5.0.5. React Timekeeper 2.2.1 and React Image Lightbox 5.1.4
retain their existing component integration. Their legacy peer constraints are
handled with the established --legacy-peer-deps installation policy; this does
not claim upstream React 19 support for those packages.

Core development dependencies explicitly include the already declared peers
AJV, AJV Keywords, Notistack, React Image Lightbox, React Linkify and React Smart
Gallery. A reinstall with --legacy-peer-deps otherwise removes these packages
and prevents source tests from resolving Notistack. Public peer ownership is
unchanged.

Firebase CLI 15 requires Java 21+. Install the official Temurin 21.0.12.1+1 JDK
for macOS x64 under ~/.local/share/redequate/jdks/temurin-21, verifying the
published SHA-256 before extraction. The emulator test launcher uses its
Contents/Home for JAVA_HOME and PATH only in the child process when present.
Other environments inherit their Java configuration and require Java 21+.
System Java and other projects' Java settings are unchanged.

Deferred: TypeScript stays at 5.9.3 until typescript-eslint supports TS7 without
a second compiler API package. Babel 8 and ESLint 10 remain deferred for the
previously recorded compatibility constraints. Router stays on major 5 (web
consumers updated to 5.3.4); React Redux 8 and Redux 4 retain their current APIs.
Independent server and legacy example dependencies are outside this update.

Validation: all 101 source CSS files preserve ordered selectors, rules and
declarations with postcss-nested 9; comparison ignores comments and formatting.
ESLint across 449 files preserves its baseline diagnostics. Core unit tests
remain 874 passed / 14 failed (888 total), Firebase integration tests 91 passed /
1 failed (92 total), and Whisky tests 13 passed / 5 failed (18 total); every
failing test also fails before this update. Core and both consumer production
builds pass, including PWA service-worker and manifest generation. No deployment
is part of this dependency refresh. Public APIs, stored records and Android
contracts are unchanged.

Browser verification covers Profile, Groups, Discover, Tags, date selection,
Timekeeper's applied hour/minute value, and opening/closing the Uppy dashboard.
Lightbox opening fails under the current Vite setup with `global is not defined`.
Both the previous 5.1.1 distribution and 5.1.4 use the same `global.window`
expression in getWindowWidth/getWindowHeight. Retain 5.1.4; reverting this update
does not remove that source-level incompatibility. No global shim or replacement
viewer is introduced by this dependency update. Existing React `key`-as-prop
warnings are also outside this update.

## Local IndexedDB schema changes

The current `story/move-database-to-module` Local adapter creates 19 physical
collection stores at version 1. Each uses `_rowId` with auto-increment and a
required set of indexes, described by the JSON-compatible `LOCAL_SCHEMA` in
`packages/database/src/local/constants.js`. The record APIs continue to address
only `LOCAL_COLLECTIONS`; `applySchema` may add physical stores for other uses.

`LocalDatabase.applySchema(schema)` performs additive store and index changes in
one IndexedDB versionchange transaction. It may replace an index, but never
removes an unspecified store or index, changes a store keyPath or autoIncrement,
or deletes records. Normal opens accept an upgraded version while validating
required framework stores and indexes. The schema API belongs only to LocalDatabase
and is absent from DatabaseBase and FirebaseDatabase. This is a new API; existing
Local read/create/cursor
paths and data formats remain unchanged. Cross-tab upgrades require other open
connections to respond to `versionchange`; a noncooperating tab yields a blocked
error and the caller can retry later. The web demo and production application
should validate any schema they introduce before release; Android does not use
these browser object stores.

### Provider-specific schema API and test alignment

Decision: keep applySchema only on LocalDatabase. DatabaseBase and FirebaseDatabase
have no schema method; the Local method retains its schema parameter documentation
and all existing schema migration tests. This removes the unsupported method stub
from the provider-neutral API without changing Local schema behavior.

Existing tests now follow the current Chat implementation after its specialized
forward-cursor and scroll-anchor behavior was reverted. ChatList tests render the
real LazyList with a Redux Provider and exercise 100-entry pages, metadata filtering,
live cursor events, duplicate deliveries, end-of-list handling, overlapping requests
and unmount cleanup. ChatMeta and ChatsDaemon use their current read/listener APIs;
these tests do not claim the reverted cursor-only initialization or anchor behavior.
Dispatcher tests retain forced profile/device refresh and guest coverage. MutualList
expects the current explicit mutual_id identity field. Tags integration includes an
existing empty sort field, excludes missing fields, and verifies bounded inclusive
continuation reads and no duplicate entries. The extra continuation boundary row
is discarded; no unlimited read is accepted by that scenario.

The Whisky Talks Profile refresh table now explicitly maps tabs 1 through 4 to
Posts, My Groups, Following and Followers. Its existing four remount regression
cases pass without weakening their expectations. The post transform test uses the
current named post_id path. No Chat or cursor implementation change is part of
this test alignment.

Validation on Node.js 24.21.0: all 899 unit tests across 96 core test files pass;
all 92 Firebase integration tests across 5 files pass with the actual Emulator;
all 18 Whisky tests across 5 files pass. Framework, demo and Whisky builds pass.
Updated Chat tests are ESLint-clean; comparison of all changed source/test files
adds no lint diagnostics. Existing unrelated lint diagnostics remain. No tests
were skipped to achieve these results. Public data paths and Android contracts
are unchanged by this test alignment.
