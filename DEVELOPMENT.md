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

## Active issues and constraints

Add entries here only for architectural blockers or constraints that need to
survive the current development session.

Remove or convert them into architectural decisions when they are resolved.

Currently no persistent blocker is recorded.
