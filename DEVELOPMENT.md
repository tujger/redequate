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


### LocalTestAuth naming and intended use

Decision: rename the MemoryAuth scaffold to LocalTestAuth and publish it at
redequate/auth/local-test. Remove the old memory subpath without an alias.

Reason: the intended implementation is exclusively for testing, with future
localStorage or IndexedDB persistence. Memory-only naming misrepresented both
persistence and intended use. This module is not intended for production; it
remains an unimplemented AuthBase subclass and does not yet store data or
authenticate. Firebase remains the lazy default.
Status: validated. Build and packed ESM/CommonJS imports of local-test passed;
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
