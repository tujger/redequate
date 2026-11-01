# Database ESLint editor and shared-provider verification

## Implemented

- Recognized imported `useDatabase()` / `useBackend()` (public and source controller
  entrypoints), stable aliases, and inherited `BackendListener.this.backend`.
- Shared origins are analyzed separately for Firebase and Local. Diagnostic labels
  identify the provider; identical errors are grouped. Shared quick fixes identify
  the provider. Concrete origins retain their provider-specific behavior.
- Scope, reassignment, regular-function `this`, custom class fields and unknown or
  computed objects do not imply a provider merely from a name.
- Fixed the suggestion crash for non-string/non-array paths.
- Pinned ESLint Babel configuration to Redequate's .babelrc. JSX parsing now works
  when the ESLint process is started outside Redequate (covered by a child-process test).
- Rules and stores are unchanged. No runtime, generator, API, or deployment changes.

## Editor setup and verification boundary

The installed IntelliJ plugin's serializer uses `<files-pattern value="..." />`
in `.idea/jsLinters/eslint.xml`; its default pattern excludes JSON. The ESLint
inspection is disabled by default in the installed plugin. The active application
project had no explicit ESLint inspection profile.

Configured JSON-inclusive Run for files in both the active application project and
Redequate's standalone project. Enabled the ESLint inspection in the active
application's project profile; the standalone Redequate profile was already enabled.
Settings remain project-local; no global IDE configuration was changed. The app's
.idea files are Git-ignored; Redequate's new jsLinters/eslint.xml is untracked.
The source stores.json was opened through the sibling source module in IntelliJ.

CLI returns the four stores.json errors below. The IDE inspection API still returns
an empty list for JSON, and its batch API reports only native JS inspections for
the handler. Actual external ESLint editor annotations/quick-fix presentation are
**not confirmed**. An asynchronous question requested the user's editor observation.
Do not interpret these API results or passing CLI tests as verified visual highlighting.
If the running IDE has not reloaded the local project settings, check the ESLint
settings panel (Automatic, JSON-inclusive Run for files, inspection enabled).
No project restart or user development process was forced.

## Checks

| Check | Result |
|---|---|
| node --test tooling/__tests__/*.test.mjs | 64 PASS, 0 FAIL, 0 SKIP |
| ESLint changed JS/config/test files | 0 errors, 0 warnings |
| tsc --noEmit | PASS |
| git diff --check, both repos | PASS |
| Full own-code ESLint, baseline rule snapshot | 7110 errors, 941 warnings |
| Full own-code ESLint, updated rule | 7114 errors, 941 warnings |

The before/after comparison uses the same current working tree and ESLint config,
substituting the pre-task provider-context and query rule for the baseline; it is
not a clean-branch baseline. New diagnostics account for the four additional errors.
Six new test cases are in tooling/__tests__/eslint-shared-providers.test.mjs.
All remaining ordinary ESLint findings are preserved, not suppressed.

## Schema/path diagnostics in the full scan

- `packages/backend/src/common/handlers/posts.js:73` — [Firebase, Local] A path segment must be a non-empty string or one named non-empty string value.
- `packages/database/src/local/stores.json:48` — Local store alerts is missing index for type required by Firebase alerts/.indexOn (35:24).
- `packages/database/src/local/stores.json:170` — Local store mutualstamps index _my (_my) has no matching Firebase .indexOn declaration or documented prefix derivation.
- `packages/database/src/local/stores.json:171` — Local store mutualstamps index mutual_type (mutual_type) has no matching Firebase .indexOn declaration or documented prefix derivation.
- `packages/database/src/local/stores.json:174` — Local store mutualstamps index mutual_type_user_id (mutual_type + user_id) has no matching Firebase .indexOn declaration or documented prefix derivation.
- `src/chat/ChatsDaemon.js:83` — [Local] No Local identity index for _chats.message_id. Available fields: _id, user_id, chat_id, timestamp, private.
- `src/components/NewPostComponent/NewPostComponent.js:186` — [Local] No Local identity index for posts.edit_id. Available fields: _id, post_id, uid, to.
- `src/tags/Tag.js:195` — [Local] No Local identity index for _tag.post_id. Available fields: _id, tag_id, score.

## Modified by this task

- eslint.config.mjs
- tooling/provider-context.mjs
- tooling/eslint-database-queries.mjs
- tooling/__tests__/eslint-shared-providers.test.mjs (new)
- tooling/README.md
- DEVELOPMENT.md
- tooling/__tests__/ESLINT_DATABASE_REPORT.md
- .idea/jsLinters/eslint.xml (new, Redequate)
- TheWhiskyTalks local ignored settings: .idea/jsLinters/eslint.xml,
  .idea/inspectionProfiles/Project_Default.xml,
  .idea/inspectionProfiles/profiles_settings.xml

The user's action.js is not edited: its duplicate imports still prevent ESLint
from parsing it. Follow counter changes remain a separate task; no Follow runtime
fix was applied here. No emulator or server was started; no network ports were used.
Temporary diagnostics, bytecode inspection files and scripts are removed after checks.
Git index was not modified; existing staged/unstaged changes and AD entries remain.

## Full Git status: Redequate

```text
 M DEVELOPMENT.md
 M eslint.config.mjs
AD packages/backend/src/BackendBase.ts
AD packages/backend/src/__tests__/ListenerPath.test.js
AD packages/backend/src/common/deleteStoredFile.js
AD packages/backend/src/common/increment.ts
AD packages/backend/src/common/parseListenerPath.js
AD packages/backend/src/firebase-server/src/databaseDelete.js
AM packages/backend/src/firebase-server/src/mutual/action.js
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
 M tooling/__tests__/ESLINT_DATABASE_REPORT.md
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
?? .idea/jsLinters/eslint.xml
?? tooling/__tests__/eslint-shared-providers.test.mjs
```

## Full Git status: TheWhiskyTalks

```text
 M functions/__tests__/counter-audit.test.js
 M functions/package-lock.json
 M functions/vendor/redequate-server.tgz
 M src/App.js
 M src/definitions.js
```
