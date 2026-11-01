# Shared Firebase tooling: verification

All four application implementations moved into Redequate tooling:
`firebase.mjs`, `emulator-config.mjs`, `processes.mjs`, `seed-emulator.mjs`.
The application has no wrappers for them. It owns `firebase.config.mjs` and invokes
the common CLI directly from its existing npm scripts. Application test fixtures
remain under `scripts/__tests__/`.

## API and configuration

`redequate/tooling/firebase` exports the default `runFirebase(settings, argv)` and
named `validateFirebaseConfig`, `firebaseCLI`. Import is inert. The CLI accepts
`--config firebase.config.mjs <action> <target>` and propagates the returned exit code.
Its entry detection supports the local node_modules symlink.

Application configuration supplies project IDs, Vite modes, emulator client config,
separate test project ID, readiness callable/optional region, test file and initial
accounts/password. No TheWhiskyTalks project IDs, fixPost name or its test path are
embedded in the common implementation. Seed logic retains the same account fields,
roles, marker and idempotence, with demo-project/loopback guards.

Tools resolve through app dependencies or the tooling module location, rather than
an assumed ../redequate layout. Server preparation and watching retain the existing
framework source-workspace requirements. Rules generation/build plugin/watch,
separate test data/ports, graceful shutdown and developer snapshot export behavior
are preserved. No SDK/browser initialization occurs on importing the runner.

## Results

| Check | Result |
|---|---|
| `npm run test:tooling` | 47 passed, 0 failed |
| ESLint four moved modules and new tooling tests | 0 errors / warnings |
| Application config syntax | PASS |
| TypeScript `tsc --noEmit` | PASS |
| Public package runner import | PASS |
| Inert import and CLI entry through symlink | PASS |
| `npm run build:server:dev` via new CLI | PASS |
| Real Database Emulator Rules hot reload | PASS |
| `npm run test:emulator` via new CLI | 4 passed, 2 failed, exit 1 |
| `git diff --check`, both repositories | PASS |
| Old application script references | None in active source/configuration |

The same two known application tests still fail:

- Activity original-type index/concurrent events: expected undefined, read `{legacy: 1}`.
- Native increment marker through callable: functions/invalid-argument, `Record update failed. [400]`.

No backend algorithm or test expectation was changed to hide these failures. The
application suite is not claimed green. It reached readiness, seeded the configured
accounts and ran all six tests through the common runner, then shut down gracefully.
The unchanged live Rules test separately verified base/inline/imported edits,
indexes, validation, invalid-expression rejection and recovery without restarting
Database Emulator; its dynamic ports and temporary files were released/removed.

The app suite used demo-thewhiskytalks-test with ports 19099, 19000, 15001, 19199,
14400, 14500, 19299 and 19499; UI disabled (unused configured port 14000). All these
ports were verified free before and after. TMPDIR/TMP/TEMP were private; its generated
Rules/config/data were disposable. No developer snapshot was imported/exported.
Functions archive, manifest and lockfile were compared/restored against exact
pre-suite copies. No deployment command was run and no production operation occurred.

## Follow-up file changes

Redequate: four tooling modules; public runner package export; nine new tests in
`tooling/__tests__/firebase-tooling.test.mjs`; `tooling/FIREBASE.md`, tooling README,
Rules guide and DEVELOPMENT.md; this report. No dependencies were added.

Application: `firebase.config.mjs`, npm script command paths and README; four script
implementations deleted. Existing command names, App.js and other user edits were
preserved. Demo repository was not modified.

## Git status

### Redequate

```text
 M DEVELOPMENT.md
 M package.json
AD packages/backend/src/BackendBase.ts
AD packages/backend/src/__tests__/ListenerPath.test.js
AD packages/backend/src/common/deleteStoredFile.js
AD packages/backend/src/common/increment.ts
AD packages/backend/src/common/parseListenerPath.js
 M packages/backend/src/firebase-server/src/database/callable/create.js
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
A  tooling/__tests__/firebase-tooling.test.mjs
A  tooling/emulator-config.mjs
AD tooling/eslint-local-stores.test.mjs
AD tooling/firebase-rules.test.mjs
AM tooling/firebase.mjs
A  tooling/migrations/firebase-rules/demo-differences.json
A  tooling/migrations/firebase-rules/edeqa-pwa-react-demo.patch
A  tooling/processes.mjs
AD tooling/schema-paths.test.mjs
AM tooling/seed-emulator.mjs
AD tooling/test-emulators.mjs
?? tooling/FIREBASE.md
?? tooling/__tests__/FIREBASE_TOOLING_REPORT.md
```

### TheWhiskyTalks

```text
 M .gitignore
 M README.md
A  firebase.config.mjs
 M package.json
 D scripts/emulator-config.mjs
 D scripts/firebase.mjs
 D scripts/processes.mjs
 D scripts/seed-emulator.mjs
 M src/App.js
```


## Final cleanup

Verified preservation of original staged diff blocks in both repositories and exact Functions artifact bytes. No own Emulator processes remained; app suite ports were rebound successfully. The standalone live suite verified its own dynamic ports. Temporary backups and logs were deleted after recording this report.
