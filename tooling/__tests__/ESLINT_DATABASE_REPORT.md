# Database ESLint-only verification

The type/declaration approach was withdrawn. Its generator, generated schema.d.ts,
JSDoc overloads, package types entries and declaration build hooks are absent.
Git diff checks confirmed no changes to the provider runtime files, package exports,
Core or Server build configuration remain from that approach.

## Result

- Both repository database rules are configured as **error**.
- stores.json compares to the provider base database.rules.json.
- Firebase paths/indexes use that same base; Local paths use Local stores.json.
- Application additions/settings/environment overrides do not change these lint sources.
- All direct CRUD/read/cursor/listener methods and supported concrete backend
  database requests are checked. Scoped aliases, concrete inheritance, explicit
  simple JSDoc/TS annotations, partial dynamic values, batches and cursor sources
  are covered. Unknown providers/custom schemas are not guessed.
- Quick fixes preserve path form and filter values. Mutable or escaped const paths
  are not assumed to retain their initial contents.
- No IDE autocomplete implementation, new dependency, runtime API or build feature
  was added. These are ESLint diagnostics and quick fixes.

## Verification

| Check | Result |
|---|---|
| npm run test:tooling | 58 passed, 0 failed |
| ESLint changed files | 0 errors / warnings |
| tsc --noEmit | PASS |
| git diff --check | PASS |
| Full ESLint | 7072 errors / 939 warnings, nonzero exit |
| redequate/local-stores in full scan | 4 errors |
| redequate/database-queries in full scan | 0 errors |

The remaining 7068 errors belong to other ESLint rules/files. No existing style rules were
disabled to hide them. The path checker passes the valid/unknown-provider cases in
the current source; malformed calls and their fixes are exercised by regression tests.

The four exposed stores.json discrepancies are:

1. alerts is missing the Local index for Firebase root index type.
2. mutualstamps._my has no matching declaration or supported prefix derivation.
3. mutualstamps.mutual_type has no matching declaration or supported prefix derivation.
4. mutualstamps.mutual_type_user_id has no matching declaration or supported prefix derivation.

No stores, indexes or Rules were edited to suppress those errors. Existing compound
index, identity-index and proper-prefix comparison contracts were retained.

One existing watcher test was stabilized to wait for at least one error rather than
exactly one notification; it could otherwise miss two closely spaced reports. No
watcher runtime code changed.

## Editor boundary

CLI ESLint and repository JSON configuration were verified. IntelliJ did not have
Redequate open as a project; an inspection through the app's node_modules symlink
returned no IDE diagnostics. Therefore the actual editor red underline/quick-fix
presentation is not claimed verified. ESLint must run on the own-project JSON/source
file, rather than an excluded dependency path. No native IDE plugin was installed.

## Files

Logic/configuration: eslint.config.mjs; tooling/database-schema.mjs;
provider-context.mjs; schema-paths.mjs; eslint-database-queries.mjs;
eslint-local-stores.mjs. Tests stay under tooling/__tests__, including the new
eslint-provider-paths.test.mjs. Existing fixtures are injected through test factories;
production lint rules always use the base reader. Documentation reflects this source
policy. Application, server logic, Rules composition and production Firebase were
not changed by this follow-up. No servers or emulators were started for these static
checks; the process-manager unit test cleaned up its own short-lived child.

## Final Git status

```text
 M DEVELOPMENT.md
 M eslint.config.mjs
AD packages/backend/src/BackendBase.ts
AD packages/backend/src/__tests__/ListenerPath.test.js
AD packages/backend/src/common/deleteStoredFile.js
A  packages/backend/src/common/handlers/mutual.js
 M packages/backend/src/common/handlers/mutualrequests.js
AD packages/backend/src/common/increment.ts
AD packages/backend/src/common/parseListenerPath.js
AD packages/backend/src/firebase-server/src/databaseDelete.js
AD packages/backend/src/firebase-server/src/notification/sendToTokens.js
AD packages/backend/src/local-client/database/delete.js
AD packages/backend/src/local-client/database/update.js
AD packages/backend/src/local/database/addEventListener.js
AD packages/backend/src/local/database/connection.js
AD packages/backend/src/local/database/constants.js
AD packages/backend/src/local/database/context.js
AD packages/backend/src/local/database/identity.js
AD packages/backend/src/local/database/row.js
AD packages/backend/src/local/database/schema.js
AD packages/backend/src/local/database/storeSchema.js
AD packages/backend/src/local/database/stores.json
AD packages/database/src/__tests__/firebase/FirebaseCursorAdapter.test.js
AD packages/database/src/__tests__/local/NativeCursorListeners.test.js
AD packages/database/src/__tests__/local/NativeQueries.test.js
AD packages/database/src/__tests__/local/NativeSchema.test.js
AD packages/database/src/__tests__/local/NativeStore.test.js
AD packages/database/src/common/validateFirebaseValue.js
AD packages/database/src/firebase/createCursorAdapter.js
AD packages/database/src/local/context.js
AD packages/database/src/local/defaultStorageId.js
AD packages/database/src/local/values.js
AD src/helpers/formatConsoleError.js
 M tooling/FIREBASE_RULES.md
AD tooling/FIREBASE_RULES_REPORT.md
 M tooling/README.md
 M tooling/__tests__/eslint-local-stores.test.mjs
AM tooling/__tests__/eslint-provider-paths.test.mjs
 M tooling/__tests__/firebase-rules-watch.test.mjs
 M tooling/__tests__/firebase-rules.test.mjs
 M tooling/__tests__/schema-paths.test.mjs
AD tooling/database-declarations.mjs
A  tooling/database-schema.mjs
 M tooling/eslint-database-queries.mjs
 M tooling/eslint-local-stores.mjs
AD tooling/eslint-local-stores.test.mjs
AD tooling/firebase-rules.test.mjs
A  tooling/migrations/firebase-rules/demo-differences.json
A  tooling/migrations/firebase-rules/edeqa-pwa-react-demo.patch
AM tooling/provider-context.mjs
 M tooling/schema-paths.mjs
AD tooling/schema-paths.test.mjs
AD tooling/test-emulators.mjs
?? tooling/__tests__/ESLINT_DATABASE_REPORT.md
```

## Cleanup verification

Original staged diff blocks were preserved. Provider/runtime/package/build files have no remaining declaration-related diff. The removed generator/schema files are absent. No task processes remained; owned temporary logs and declaration probes were removed after recording results.
