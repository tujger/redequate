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

## Active issues and constraints

Add entries here only for architectural blockers or constraints that need to
survive the current development session.

Remove or convert them into architectural decisions when they are resolved.

Currently no persistent blocker is recorded.
