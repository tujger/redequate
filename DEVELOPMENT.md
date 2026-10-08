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

## Active issues and constraints

Add entries here only for architectural blockers or constraints that need to
survive the current development session.

Remove or convert them into architectural decisions when they are resolved.

Currently no persistent blocker is recorded.

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
