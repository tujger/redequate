# Project instructions

## Code style

- Do not add wrapping parentheses `()` around JSX components in `return` statements or JSX markup unless necessary.
- Do not replace or remove Material UI icons during component conversions; keep their imports and usage unchanged.
- Use the minimum nesting needed to express selector relationships.
- Keep independent component classes at the top level.
- Use nesting for pseudo-classes, modifiers, global descendants, and selectors that require a parent relationship.
- Keep all at-rules, including `@media`, at the top level.
- Do not introduce wrapper nesting solely for visual grouping.
- Use CSS Module classes directly in the component. Remove `classes` from component props when external styling overrides are not needed.
- Prefer CSS custom properties for dynamic visual values when a modifier class would only carry a variable value.
- Use `useRippleEffect` for interactive controls that behave like buttons or navigation actions when visible Material UI-like press feedback is appropriate.
- Do not add ripple effects to passive containers, layout wrappers, loading placeholders, or components whose child already owns the interaction.
- When planning a component conversion, explicitly identify interactive elements that need ripple feedback and state whether ripple is required, unnecessary, or blocked by a child component API.
- Always structure CSS by selector ownership: keep shared properties in the owning class, nest pseudo-classes, attribute selectors, and dependent descendants under that class, keep independent component classes at the top level, and keep all at-rules at the top level.
- Always use `&` for nested CSS selectors, including pseudo-classes, modifiers, and dependent descendants; keep independent component classes at the top level.
- Prefer the minimum nesting depth possible; avoid adding a nesting level when the same selector relationship can be expressed directly.

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
3. Keep framework changes separate from unrelated application changes where practical.
4. Prefer incremental migrations that can be tested in real consumers before merging.

The framework, demo application, and production application should be treated as a validation chain:

`redequate → edeqa-pwa-react-demo → thewhiskytalks`

## Development memory

`DEVELOPMENT.md` is the persistent architectural memory for this project.

Read it before making significant architectural changes.

Update it when a development session produces:

- an architectural decision;
- a significant newly discovered constraint;
- a compatibility issue affecting consumers;
- a change to the project roadmap or migration order;
- an unresolved blocker that should survive the current development session;
- a decision to reject an otherwise plausible implementation approach.

Do not add:

- routine code changes;
- information already obvious from Git history;
- temporary debugging observations;
- completed low-level TODOs;
- descriptions of individual commits.

For decisions, record:

- the decision;
- the reason;
- important consequences;
- rejected alternatives when they matter;
- affected consumers when applicable;
- current status.

Keep entries concise.

Cross-repository architectural decisions belong primarily in
`redequate/DEVELOPMENT.md`.

Consumer repositories should record only decisions specific to that application
unless a cross-repository decision has not yet been recorded here.
