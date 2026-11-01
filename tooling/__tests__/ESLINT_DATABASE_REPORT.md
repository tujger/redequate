# ESLint tests aligned with the current implementation

## Scope

Updated existing tests only, following the user's confirmation to target the
current working-tree implementation. No runtime, Rules, stores, provider, IDE
configuration or Git index changes were made by this cleanup.

The current ESLint implementation differs from the previous report: it exports
neither createDatabaseQueries nor createLocalStoresRule; database-schema.mjs and
provider-context.mjs are absent. This report supersedes the earlier claims about
those modules and the expanded shared-provider diagnostics. Historical reports
from other tasks were left untouched.

## Test organization

- eslint-provider-paths.test.mjs owns ESLint query diagnostics, configuration,
  known provider imports/aliases, conservative handling of dynamic queries,
  source locations and safe suggestions. Unique nested-field and compound-prefix
  scenarios were moved here from schema-paths.test.mjs.
- schema-paths.test.mjs contains only direct analyzePath tests for Firebase/Local
  path semantics, nested orderBy fields, invalid options and compound indexes.
- eslint-local-stores.test.mjs uses the actual public plugin and its settings-based
  Rules loader. Removed the nonexistent factory import and unnecessary wrapper
  composition; kept the index/compound-prefix, loader-error and source-location cases.
- firebase-rules.test.mjs checks that both ESLint plugins read configured composed
  Rules, then report invalid application configuration after the source changes.
- Removed eslint-shared-providers.test.mjs and obsolete expectations for hooks,
  BackendListener inference, CRUD/listener/backend requests, TS/JSDoc inference,
  scope-aware provider tracking, base-only linting and foreign-CWD JSX support.
  These features are not implemented in the current runtime; their tests were not
  converted into assertions that claim those features work.

## Current implementation boundaries

Query linting handles statically recognized concrete Local/Firebase read/cursor
calls. Repository ESLint configuration currently enables both database rules as
warnings. Configured Rules additions affect both validators. Dynamic values can
prevent suggestions; unknown Firebase roots can be accepted through parent
permission fallback. These are existing behaviors, not runtime fixes made here.

Visual IDE highlighting remains unverified; no claim of editor verification is made.

## Validation

| Check | Result |
|---|---|
| Tooling baseline before cleanup | 25 PASS, 10 FAIL, 0 SKIP |
| node --test tooling/__tests__/*.test.mjs after cleanup | 49 PASS, 0 FAIL, 0 SKIP |
| ESLint four changed test files | 0 errors, 0 warnings |
| tsc --noEmit | PASS |
| git diff --check | PASS |
| Git index byte comparison with pre-edit snapshot | Unchanged |

The baseline counted failed file imports as individual failures, so its test count
is not comparable to the final count. The prior report's 64-pass result described a
different runtime state. The tooling suite used dedicated OS temporary storage
through TMPDIR, TMP and TEMP. No server or emulator was started and no network port was
allocated. Temporary scripts, logs and snapshots were removed after verification.
