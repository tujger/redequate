> Test artifacts were subsequently moved into `tooling/__tests__`; the status below records the earlier verification run.

# Firebase Rules centralization: verification report

Implementation is confined to Redequate. Consumer repositories were inspected read-only;
patches were prepared inside Redequate and checked without applying them. No Firebase
deployment, installation, commit, push, reset or clean was performed.

## Implementation and API

- Base: `packages/database/src/firebase/database.rules.json`, structurally identical
  to the authoritative TheWhiskyTalks rules inspected during this task.
- Pure composition algorithm: [rules.mjs](../../packages/database/src/firebase/rules.mjs).
  The complete executable implementation is in `resolveRules`, not duplicated in tooling.
- Public ESM/CJS: `redequate/database/firebase/rules` exports `baseRules` and
  `resolveRules(baseRules, {additions, overrides})`.
- Constructor: `new FirebaseDatabase({backend, firebase, onError, rules})` stores
  the resolved snapshot at `database.rules`. It does not contact Firebase.
- Node extraction/generation and ESLint loading: `tooling/firebase-rules.mjs`.
  Public import: `redequate/tooling/firebase-rules`.
- Integration, security policy, shared-database manifest and consumer commands:
  [FIREBASE_RULES.md](../FIREBASE_RULES.md).
- Additional direct dependency: existing `@babel/parser` version range ^7.29.9,
  required for consumer-side static JSX/TS argument extraction. The installed
  version and dependency graph were reused; no dependencies were installed.

Composition validates and clones inputs, recursively adds branches, unions indexes,
rejects permission/validation conflicts, applies explicit exact-path overrides and
checks newly changed permissions against potentially overlapping inherited grants.
It does not infer expression equivalence, delete branches, combine independent
indexes into compound indexes, modify stores.json or deploy anything.

## Checks

| Check | Result |
|---|---|
| Tooling: `node --test tooling/__tests__/*.test.mjs` | 33 passed, 0 failed |
| New runtime Rules Vitest | 1 passed |
| `tsc --noEmit` | PASS |
| `npm run 'build core'` | PASS |
| `npm run 'build server'` | PASS |
| Built rules-only ESM and CJS imports with SDK imports actively blocked | PASS |
| `npm pack --dry-run --json --ignore-scripts` | PASS: built exports, source JSON/resolver and tooling included |
| Base equivalence to TheWhiskyTalks; empty additions | PASS |
| Consumer patch `git apply --check`, both apps | PASS |
| Generation from temporary consumer configurations | PASS, both apps |
| Database Emulator compilation and REST checks of both generated consumer artifacts | PASS: 6 assertions; demo-only branches retained |
| `npm run test:integration` | 7 files passed; 158 passed, 9 expected failures |
| Full Vitest unit run | 18 files failed / 121 passed; 62 failed, 1484 passed, 11 expected failures |
| ESLint changed JS/MJS files | 12 files; 0 errors, 0 warnings |
| Full final ESLint | 7065 errors, 943 warnings; exit 1 |
| `git diff --check` | PASS |

The full unit suite remains red. Failures include backend rebuild/status imports,
BackendIncrement/UpdateCounter expectations, listener behavior, and Local identity/
schema tests outside this change. A restored pre-task temporary copy was also red,
but its linked-dependency environment caused extra suite-loading differences; its
33 failed tests / 23 failed files are **not** a directly comparable regression count.
The new runtime test passes separately; the full suite is not claimed to be green
or fully regression-cleared. These unrelated failures were not rewritten.

The production-Rules integration scenario performs 192 read/create/update/delete
cases with real Auth Emulator ID tokens across six protected/public paths, comparing
base and composed Rules including stored values. It also checks retained timestamp
indexes, added created indexes, scalar/null/object writes and explicit validation.
It restores the independent security-test fixture in finally. That fixture stays
an intentional test base with different root permissions, resolved through the same
composer; it is not presented as the production template.

Observed build diagnostics include ignored third-party `use client` directives and
existing mixed named/default export warnings. Auth Emulator warns that
`canHandleCodeInApp` is unsupported. Neither Rules artifact produced a compiler
warning or error.

## ESLint baseline

| Population | Before errors | Before warnings | Final errors | Final warnings |
|---|---:|---:|---:|---:|
| Original full scan, including build/dependency resources | 315911 | 5611 | — | — |
| Own code under final exclusions | 7065 | 940 | 7065 | 943 |
| Files changed for this task | — | — | 0 | 0 |

All existing ESLint rules and severities were retained. The three-warning increase
comes from replacing the old missing-Rules-configuration warning for stores.json
with four actual schema diagnostics:

1. `alerts` lacks the Local index matching root `.indexOn: type`.
2. `mutualstamps._my` has no matching Rules index or supported derivation.
3. `mutualstamps.mutual_type` has no matching Rules index or supported derivation.
4. `mutualstamps.mutual_type_user_id` has no matching Rules index or supported derivation.

These warnings were preserved; no indexes or stores were invented to silence them.

## Isolation and limitations

Firebase CLI 15.34.1, Database Emulator 4.11.2, Node.js 26.12.1, Java 22.0.2.
The existing integration runner uses a unique demo project, random nondefault ports,
private TMPDIR/TMP/TEMP, no developer snapshot and no production credentials. It
verified release of all allocated ports and removed its temporary directory.
The additional migration suite used `demo-redequate-migration` and loopback ports
23400 (Database), 23401 (Hub), 23402 (Logging); all were verified free before and
after. UI and other emulators were disabled. Cleanup verification is recorded below.

Application integration consists of generation, patch validation and real Emulator
checks on temporary configurations. Application builds and the TheWhiskyTalks full
Functions suite were not run because consumer migration patches were not applied.
Demo's legacy `_activity` was admin-readable; the accepted base makes it public.
Other demo-only collections are retained by the prepared additions/explicit grants.

A shared RTDB requires a complete database-owned manifest. The resolver cannot
preserve rules of applications omitted from that manifest and never reads remote
production Rules. An arbitrary Firebase expression is not semantically proved safe;
new inherited conflicts require explicit overrides. Existing broad parent grants
remain as-is. Deployment remains a separate reviewed operation.

## Files changed for this task

- `DEVELOPMENT.md`
- `eslint.config.mjs`
- `package.json`
- `package-lock.json`
- `packages/database/build.mjs`
- `packages/database/src/firebase/database.rules.json`
- `packages/database/src/firebase/rules.mjs`
- `packages/database/src/firebase/index.js`
- `packages/database/src/__tests__/firebase/FirebaseRules.test.js`
- `packages/database/src/__tests__/firebase/FirebaseRules.integration.test.js`
- `tooling/README.md`
- `tooling/FIREBASE_RULES.md`
- `tooling/__tests__/FIREBASE_RULES_REPORT.md`
- `tooling/firebase-rules.mjs`
- `tooling/__tests__/firebase-rules.test.mjs`
- `tooling/eslint-database-queries.mjs`
- `tooling/eslint-local-stores.mjs`
- `tooling/__tests__/eslint-local-stores.test.mjs`
- `tooling/__tests__/test-emulators.mjs`
- `tooling/migrations/firebase-rules/demo-differences.json`
- `tooling/migrations/firebase-rules/thewhiskytalks.patch`
- `tooling/migrations/firebase-rules/edeqa-pwa-react-demo.patch`

Existing user changes in README.md, server files, removed legacy paths and all 29
AD entries were preserved. The original staged diff blocks were compared and remain
identical. This agent did not execute Git staging commands.

## Full final Git status

```text
 M DEVELOPMENT.md
 M README.md
 M eslint.config.mjs
 D link-redequate-react.sh
 M package-lock.json
 M package.json
AD packages/backend/src/BackendBase.ts
AD packages/backend/src/__tests__/ListenerPath.test.js
AD packages/backend/src/common/deleteStoredFile.js
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
 M packages/database/build.mjs
AD packages/database/src/__tests__/firebase/FirebaseCursorAdapter.test.js
AD packages/database/src/__tests__/local/NativeCursorListeners.test.js
AD packages/database/src/__tests__/local/NativeQueries.test.js
AD packages/database/src/__tests__/local/NativeSchema.test.js
AD packages/database/src/__tests__/local/NativeStore.test.js
AD packages/database/src/common/validateFirebaseValue.js
AD packages/database/src/firebase/createCursorAdapter.js
A  packages/database/src/firebase/database.rules.json
 M packages/database/src/firebase/index.js
AM packages/database/src/firebase/rules.mjs
AD packages/database/src/local/context.js
AD packages/database/src/local/defaultStorageId.js
AD packages/database/src/local/values.js
 M packages/server/README.md
 D packages/server/prepare-redequate-server.mjs
 D packages/server/watch-redequate-server.mjs
 D src/__tests__/test-emulators.mjs
AD src/helpers/formatConsoleError.js
AM tooling/README.md
AM tooling/eslint-database-queries.mjs
AM tooling/eslint-local-stores.mjs
AM tooling/eslint-local-stores.test.mjs
A  tooling/link-redequate-react.sh
A  tooling/local-store-metadata.json
A  tooling/prepare-redequate-server.mjs
A  tooling/schema-paths.mjs
A  tooling/schema-paths.test.mjs
AM tooling/test-emulators.mjs
A  tooling/watch-redequate-server.mjs
?? packages/database/src/__tests__/firebase/FirebaseRules.integration.test.js
?? packages/database/src/__tests__/firebase/FirebaseRules.test.js
?? tooling/FIREBASE_RULES.md
?? tooling/FIREBASE_RULES_REPORT.md
?? tooling/firebase-rules.mjs
?? tooling/firebase-rules.test.mjs
?? tooling/migrations/firebase-rules/demo-differences.json
?? tooling/migrations/firebase-rules/edeqa-pwa-react-demo.patch
?? tooling/migrations/firebase-rules/thewhiskytalks.patch
```

## Final cleanup verification

No own Emulator processes remained. Migration ports 23400–23402 were rebound successfully. The integration runner temporary directory was absent. The task temporary directory (baseline copy, generated consumer configurations and logs) was removed after recording this report.

## Test layout follow-up

Moved all tooling test files, the Emulator runner and this report into `tooling/__tests__/`. Updated scripts, imports, fixture/root paths, ESLint and documentation. Verification: tooling 33/33; Rules unit 1/1; Emulator 158 passed with 9 expected failures; changed-file ESLint and git diff --check passed. The runner verified release of its allocated ports and removed its temporary directory. No own Emulator process remained. The staged entries present before relocation were preserved.
