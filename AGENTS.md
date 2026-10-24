# Project instructions

## Code style

- Do not replace or remove Material UI icons during component conversions; keep their imports and usage unchanged.
- Always structure CSS by selector ownership: keep shared properties in the owning class; nest pseudo-classes, attribute selectors, modifiers, global descendants, and other dependent selectors under that class; keep independent component classes at the top level.
- Use CSS Module classes directly in the component. Remove `classes` from component props when external styling overrides are not needed.
- Prefer CSS custom properties for dynamic visual values when a modifier class would only carry a variable value.
- Do not add ripple effects to passive containers, layout wrappers, loading placeholders, or components whose child already owns the interaction.
- When planning a component conversion, explicitly identify interactive elements that need ripple feedback and state whether ripple is required, unnecessary, or blocked by a child component API.

## Project role

Redequate is the core framework of a larger application ecosystem.

Main consumers:

- `tujger/edeqa-pwa-react-demo` — reference/demo application.
- `tujger/thewhiskytalks` — production application.
- `tujger/thewhiskytalks-android` — Android client for The Whisky Talks.

Changes to Redequate should be evaluated for compatibility with the web consumers.
Changes that affect APIs, data formats, authentication, URLs, or application behavior should also be evaluated for possible impact on the Android client.

## Project roadmap

The current modernization sequence is:

1. CSS Modules and removal of direct Material UI dependency — completed.
2. React 19 migration and stabilization — current.
3. Migrate the web build system to Vite.
4. Add SSR support.
5. Evolve Redequate toward a business-oriented framework.
6. Build customer-oriented demos.
7. Validate the framework with potential customers.

Do not start a later architectural migration merely because it is next on the roadmap.
Finish and stabilize the current milestone across relevant consumers first.

In particular:

React 19 → Vite → SSR

These should be treated as separate migration milestones so that runtime/library,
build-system, and rendering changes can be isolated and validated independently.

## Development workflow

Development normally happens in `story/*` or `bugfix/*` branches.

Do not assume `master` represents the current development state.

When evaluating or implementing a significant framework change:

1. Check whether the same migration has corresponding branches or changes in
   `edeqa-pwa-react-demo` and `thewhiskytalks`.
2. Consider compatibility with both applications.
3. Prefer incremental migrations that can be tested in real consumers before merging.

The framework, demo application, and production application should be treated as a validation chain:

`redequate → edeqa-pwa-react-demo → thewhiskytalks`

## Development memory

`DEVELOPMENT.md` is the persistent architectural memory for this project.

Cross-repository architectural decisions belong primarily in
`redequate/DEVELOPMENT.md`.
