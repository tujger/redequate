# Firebase Database Rules

`packages/database/src/firebase/database.rules.json` is the authoritative Redequate
base. It preserves the current TheWhiskyTalks rules, including empty wildcard
identity declarations. Auth/users, posts/tags, chats, alerts, relationships,
activity, counters, errors and meta are Redequate features. Demo-only games,
legacy follow/watch collections and game dictionaries remain application additions.
Admin SDK operations used by Firebase Functions bypass client Rules; no separate
Functions permissions or trigger changes are introduced.

## Public API

```js
import Database from "redequate/database/firebase";
import {baseRules, resolveRules} from "redequate/database/firebase/rules";

const database = new Database({
    backend,
    firebase,
    rules: {
        additions: {
            posts: {".indexOn": ["created", "author_id"]},
            app_records: {"$record_id": {}}
        },
        overrides: {"users_public/.read": "auth != null"}
    }
});
// database.rules is a local snapshot, never an SDK deployment.
const finalRules = resolveRules(baseRules, {additions: {}, overrides: {}});
```

The rules-only export has no SDK, React, browser or Node I/O dependency. Both ESM
and CommonJS builds include the base JSON. Source modules are also packaged for
Node tooling. `@babel/parser`, already used transitively in development, is now a
direct production dependency because consumer-side extraction must parse JSX/TS
without loading application code. No new package version was downloaded.

Composition validates the inputs, clones the base, recursively adds branches,
unions `.indexOn` in first-seen order, rejects differing access/validation
expressions, applies exact directive overrides and checks changed access rules
against overlapping ancestor/descendant and wildcard paths. Existing broad grants
are preserved. New inherited grants or ineffective child restrictions require an
explicit override. Boolean false is treated as non-granting; arbitrary expression
strings are conservatively potentially granting. This is not a theorem prover for
Firebase expressions. Overrides explicitly acknowledge their security consequences;
review them before deployment. Deletion/replacement of branches or indexes is not
supported. Malformed expressions are ultimately rejected by Firebase's compiler.

In particular, existing `chats/.write: true` and `users_public/.write: true` cannot
be restricted by their child `.write` expressions. This migration preserves that
behavior; it does not silently harden or broaden those permissions.

## One configuration per database

Create `database-rules.config.json` in the database-owning project:

```json
{
    "providers": [
        {"file": "src/App.js", "binding": "database"}
    ],
    "output": ".firebase/generated/database.rules.json"
}
```

When several applications share one RTDB, list **all** provider sources here in a
reviewed order, using paths relative to this configuration. All deployments,
linters and tests must reference this same configuration. Missing sources or
conflicting expressions/overrides fail the build. The builder never discovers
unlisted applications, downloads remote Rules or preserves unknown branches by
merging a previous generated artifact. An incomplete manifest can therefore drop
an unlisted application's rules: database ownership and manifest completeness
must be reviewed before deployment. Do not run a per-app manifest against a shared
production database.

The extractor selects the named `const database = new Database(...)` from an explicit
`redequate/database/firebase` or `redequate/database/local` import. It reads only
`rules`, so Firebase initialization elsewhere is not executed. Supported values are
JSON-compatible literals, local const bindings, relative default JSON imports,
exported constants and static object spreads. Calls, conditional rules, mutations,
escaping constants, cyclic references and conflicting spread properties fail with
source coordinates. An absent `rules` argument means empty additions. For Local,
`rules` is build metadata only and does not alter IndexedDB schema or behavior.
Arbitrary dynamic application code is deliberately not evaluated.

```sh
node node_modules/redequate/tooling/firebase-rules.mjs database-rules.config.json
# Inside the Redequate checkout:
npm run rules:build -- /absolute/path/database-rules.config.json
```

Generation writes a strict JSON file atomically only after successful resolution,
and does not rewrite identical content. The configured `firebase.json` database.rules
path points at that generated file. Generated files are disposable and must not be edited.

### Automatic application workflow

TheWhiskyTalks is connected directly; daily development requires only:

```sh
# Redequate terminal
npm run "start core"
# TheWhiskyTalks terminal
npm run start:emulator
```

The application generates Rules before Emulator startup and owns a `watchRules`
subscription until shutdown. Changes to the base JSON, provider arguments, imported
constants or database configuration regenerate the artifact. The existing Firebase
CLI watcher compiles and applies it to the running Database Emulator. Changes to
Rules do not restart the Emulator or frontend. Node tooling rereads the base JSON
on every generation instead of reusing an import cache.

A failed initial generation stops startup. A later generation failure keeps the
last generated artifact and reports the error; correcting a source resumes generation.
Firebase expression compilation errors are separately reported by Firebase CLI,
which retains its last accepted Rules until a valid update. A generated-file log
is not a compilation confirmation: CLI prints `Rules updated.` after acceptance.
Changing the output path requires an application restart.

The application's Vite config uses `firebaseRulesBuildPlugin(configFile)` with
`apply: 'build'`, generating Rules before both ordinary builds and builds inside
hosting deployment. Build failure aborts the build. No manual rules-build command
is required. Existing deployment targets are unchanged; building does not publish
Rules or modify production.

`test:emulator` writes its own generated Rules into its isolated temporary configuration
through `buildRules(configFile, {output})`; it runs no persistent Rules watcher.
The programmatic output override changes only artifact location, not its contents.
All paths and source-overwrite protections are still checked.

## ESLint and tests

Both validators use `loadRules` from `redequate/tooling/firebase-rules` and the same
resolver as generation. Set this in the consumer's ESLint configuration:

```js
settings: {
    redequateDatabase: {
        rulesConfig: "/absolute/path/database-rules.config.json"
    }
}
```

`REDEQUATE_RULES_CONFIG` is an alternative. Without configuration, tooling resolves
the built-in base. Legacy `firebaseRules` / `REDEQUATE_FIREBASE_RULES` still accepts
an explicitly chosen complete strict JSON file. Setting both mechanisms is an
error. Resolution failures are reported by both plugins, never silently ignored.
Locations for generated Rules refer to the deterministic resolved JSON; legacy
file locations continue to refer to the supplied file.

Local compound indexes still require their original declarations in Rules.
Separate `.indexOn` entries are not combined into compound indexes; only the
existing proper-prefix derivation is supported. `orderBy` arrays remain a single
nested field path. Unique Local identities and Firebase data paths retain their
existing meanings. No stores.json file is generated or changed here.

Tests and their runner live in `tooling/__tests__/`; verification results are in
[the report](__tests__/FIREBASE_RULES_REPORT.md).

`npm run test:tooling` covers composition, extraction, generation and both ESLint
validators. `npm run test:integration` generates an isolated Rules artifact through
the resolver, uses a demo project and private temporary directories/ports, and
checks their release before deleting logs. The legacy integration fixture is an
intentional independent security-test base (root deny and test-only collections),
not a copy of production Rules. A separate integration scenario loads composed
production Rules, checks real ID-token access, writes, validation and indexed
queries, and restores the fixture in finally.

## Consumer migration

TheWhiskyTalks migration is applied: its duplicate base JSON is removed, the Firebase
config references the generated artifact, startup owns the watcher and Vite build
owns build-time generation. Its existing provider selection and arguments are unchanged.
The old TheWhiskyTalks patch has been removed because it is superseded by this integration.

The demo migration remains an **unapplied** patch in `tooling/migrations/firebase-rules/`.
Check it with `git apply --check` before applying. It preserves application-only
branches with explicit grants; integrating an equivalent watcher/build hook is a
separate consumer task. Demo's legacy `_activity` was admin-readable only; the accepted
base makes it publicly readable, as recorded in `demo-differences.json`.
No production deployment is part of this work.

For a shared database, replace each standalone example manifest with the single
complete database-owned manifest before using it. Both ESLint plugins must use that
same manifest. Applications and their Firebase CLI processes are not changed by
installing the new provider alone.

Automatic generation/watch verification: [report](__tests__/RULES_WATCH_REPORT.md).

The developer/test launcher is shared by Redequate; application-specific choices live in `firebase.config.mjs`. See [FIREBASE.md](FIREBASE.md).
