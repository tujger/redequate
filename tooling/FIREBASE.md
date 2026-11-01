# Firebase application runner

The four common scripts live in Redequate tooling:

- `firebase.mjs`: CLI and orchestration, importable as `redequate/tooling/firebase`.
- `emulator-config.mjs`: developer and isolated test configurations and generated Rules.
- `processes.mjs`: owned-process lifecycle, signals, graceful shutdown and cleanup.
- `seed-emulator.mjs`: idempotent local demo account/data seeding.

Importing them starts no processes. The runner exports `runFirebase` as default,
`validateFirebaseConfig` and `firebaseCLI`. `runFirebase(settings, [action, target])`
returns an exit code; the CLI assigns it to process.exitCode. Validation precedes
process creation. Helper modules are internal; only the runner needs a public export.

## Application configuration

An application owns one `firebase.config.mjs` with a default export:

```js
export default {
    projects: {
        dev: "configured-development-project",
        prod: "configured-production-project",
        emulator: "demo-configured-app"
    },
    modes: {dev: "server-dev", prod: "server-prod", emulator: "emulator"},
    emulator: {
        clientConfig: "config/firebase-emulator.json",
        testProjectId: "demo-configured-app-test",
        readyCallable: "applicationCallable",
        // region defaults to us-central1.
        testFile: "scripts/__tests__/emulator.test.mjs",
        seed: {
            accounts: [{localId: "configured-admin", email: "admin@example.test",
                displayName: "Configured Admin", role: "admin"}],
            password: "LocalDemoPassword!"
        }
    }
};
```

The CLI uses the configuration's directory as the application root. An import caller
provides `root` explicitly. Application-relative paths resolve against that root,
not the shell's working directory. The conventional paths are `firebase.json`,
`database-rules.config.json`, `functions` and `.firebase/emulator-data`.
Firebase CLI and Vite resolve through the application's dependencies. Framework
scripts resolve relative to tooling; the runner does not assume a sibling checkout
named ../redequate. The server preparation/watch tools retain their existing
framework source-workspace requirements.

`readyCallable`, when present, checks the registered callable using an anonymous
POST and waits for HTTP 401 / UNAUTHENTICATED. Its name and optional region come
from configuration. Without it, readiness requires all four suite services to be
registered. The runner currently orchestrates Functions, Database, Auth and Storage.
The optional seed object supplies account data; omitting it skips seeding.

Seeding accepts only demo-prefixed project IDs and loopback HTTP emulator URLs.
It preserves the existing `meta/emulatorSeed` marker, users_public and roles schema.
Existing accounts are not recreated. Applications sharing one demo database should
agree on the initial dataset and marker lifecycle.

## Commands

The application's npm scripts call the common CLI directly, with no local wrapper:

```sh
node node_modules/redequate/tooling/firebase.mjs --config firebase.config.mjs start emulator
node node_modules/redequate/tooling/firebase.mjs --config firebase.config.mjs build dev
```

Supported actions: start, build, deploy-hosting, deploy-functions, test. Emulator
target supports start/test; test supports only the emulator target. Targets and
Vite modes must be explicitly configured. Existing TheWhiskyTalks npm command
names are unchanged. Hosting deploy still builds then deploys only hosting;
Functions deploy still deploys only Functions. No deployment is performed on import.

## Rules and process lifecycle

Developer startup generates Rules, owns the Rules watcher and starts the suite,
then waits for its own Hub and readiness, seeds data, starts the server watcher and
frontend. Builds generate Rules through the existing Vite plugin. See
[FIREBASE_RULES.md](FIREBASE_RULES.md).

Test mode creates an independent demo project configuration, increments the
configured service ports by 10000, assigns separate Hub/Logging/Eventarc/Tasks
ports, disables UI and generates disposable Rules. TMPDIR/TMP/TEMP point at the
suite's own runtime directory for Emulator processes. It never imports or exports
the developer snapshot. Invalid temporary Rules paths are rejected and partially
prepared temporary directories are removed on failure.

On exit the runner closes the Rules watcher, signals only its owned processes,
waits for CLI shutdown/export and cleans up its temporary configuration. Developer
starts retain the existing graceful-export verification. Signal handlers are removed.
App-specific seed and test code stays configured rather than hardcoded in tooling.

Tests and reports are in `tooling/__tests__/`; `npm run test:tooling` includes runner,
CLI/symlink, config, seed restrictions and process cleanup tests. The application
suite is run with its unchanged `npm run test:emulator` command.
