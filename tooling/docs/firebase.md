# Application tooling and Firebase

Each application supplies a root `redequate.config.json`. Paths resolve from that
file, not the shell directory. The same resolved context feeds Vite, Firebase CLI,
Functions, seeding and tests.

```json
{
  "defaultEnvironment": "remote",
  "server": {"port": 3002, "https": true, "allowedHosts": ["example.lan"]},
  "environments": {
    "remote": {"firebaseConfig": "src/firebase-config.json"},
    "emulator": {"portOffset": 10}
  }
}
```

## Configuration

| Setting | Default / meaning |
| --- | --- |
| `defaultEnvironment` | Required configured environment |
| `server` | port 3000, host 0.0.0.0, https true, allowedHosts [], polling false |
| `server.cert`, `server.key` | server.crt and server.key, relative to the JSON |
| `environments.<name>.firebaseConfig` | Existing immutable Firebase SDK JSON |
| `environments.<name>.mode` | Environment name unless explicitly supplied |
| `environments.emulator.firebaseConfig` | Optional separate SDK JSON; takes precedence over inheritance |
| `environments.emulator.sourceEnvironment` | Inherit a remote SDK; otherwise defaultEnvironment |
| `environments.emulator.portOffset`, `ports` | Offset all default ports, or override named ports |
| `environments.emulator.readyCallable`, `region` | Optional readiness probe; region defaults to us-central1 |
| `environments.emulator.seed` | Local accounts and password; existing marker prevents reseeding |
| `testing.file` | scripts/__tests__/emulator.test.mjs |
| `testing.unitEnvironment` | Unit-test SDK environment; otherwise defaultEnvironment |

SDK fields and projectId are read unchanged. The project JSON does not duplicate
project IDs or manufacture SDK credentials. Emulator initialization disables
Analytics explicitly; local FCM/email behavior belongs to the application/backend.

Default emulator ports are Auth 9099, Database 9000, Functions 5001, Storage 9199,
Hub 4400, UI 4000, Logging 4500, Eventarc 9299 and Tasks 9499. Services bind to
loopback. Isolated application tests add 10000 and disable UI. Separate applications
must configure nonconflicting frontend and emulator ports.

Server settings come from JSON; ambient HOST/PORT/HTTPS/SSL variables are not a
second project configuration. `--http` or `--https` changes one invocation.
Builds and unit tests do not need local HTTPS certificates. Real secrets remain
outside Git; SDK configuration and generated local endpoints are public settings.

Optional readyCallable must reject an anonymous empty request with
401/UNAUTHENTICATED. Without it, readiness uses registered emulator services.
Seed requests are restricted to loopback and the expected SDK project/namespace.

## Commands

Prefix actions with:

```sh
node node_modules/redequate/tooling/app.mjs --config redequate.config.json
```

| Action | Behavior |
| --- | --- |
| `start [environment]` | Local frontend against selected remote Firebase |
| `start emulator` | Local services, server watcher and frontend |
| `test-unit [environment]` | Shared Vitest setup, without emulators |
| `test emulator` | Disposable integration suite |
| `rules` | Generate composed Database Rules |
| `build [environment]` | Compile frontend and capture matching Rules |
| `preview` | Serve the last confirmed artifact |
| `deploy-hosting` | Deploy captured Rules, then Hosting, without rebuilding |
| `deploy-functions [environment]` | Prepare/lint and deploy Functions separately |

Omitted environments use defaultEnvironment; unit tests first use
 testing.unitEnvironment. Preview and web deploy accept no environment: the build
receipt selects the target. Other actions do not deploy implicitly.

Build output is `build`. A successful build records its environment/project and
Rules hash in `.redequate-build.json` and captures `.redequate-rules.json` there.
A new build invalidates the previous receipt before compilation. Missing/corrupt
receipts, changed Rules or mismatched projects require rebuilding. Web deploy uses
the captured Rules before Hosting; failure prevents Hosting publication. It neither
rebuilds Vite nor regenerates Rules. Hidden receipt files are excluded from Hosting.

## Vite, unit tests and application files

The shared preset owns React/JSX-in-js, version substitution, dependency dedupe,
PWA, globalThis and enabled source maps. Test mode adds jsdom, test globals,
`src/**/*.test.js`, restoreMocks and an exact Redequate ESM alias. The launcher uses
the same preset for Vite and Vitest; local config files are not required.
An optional vite.config.mjs can customize library settings and plugins; server
settings and output location remain framework-owned. Unit tests must not depend
on developer certificates or implicitly connect to running cloud/emulator services.

Applications retain Firebase SDK JSON, firebase.json Hosting/Functions/Storage
options, Storage Rules, ESLint settings and source code. Source firebase.json must
not duplicate generated Database or emulator sections. Browser SDK imports use
ordinary JSON or the #firebase-config file alias, not a virtual runtime module.
`.firebase/generated/emulators.json` contains only public local endpoints.

## Watchers, shutdown and data

Starts acquire one authenticated core-watcher lease per app. A canonical checkout
has one writer. Applications wait for a complete build; recoverable rebuild errors
keep existing clients running while new clients wait. Initial/fatal failure ends
startup or dependent services. The shared daemon is detached from the first
launcher's tree; it stops five seconds after its last client leaves. A manual
`npm run "start core"` remains alive without clients. Stopping that manual owner
ends its subscribers. Live incompatible/unverifiable locks must not be deleted.
Diagnostics are in ignored node_modules/.redequate-core-watch.log.

Each launcher tears down only its services and then releases its lease. Cleanup
checks process ownership/identity; it must not kill other sessions by port or a
stale PID. Allow Firebase CLI's graceful shutdown/export to finish.

Developer state imports/exports `.firebase/emulator-data/<projectId>`. SIGKILL or
machine crashes cannot guarantee export. Historical snapshots are not automatically
imported, renamed or deleted when project IDs change. Database namespace comes
from the SDK databaseURL and may differ from projectId. Empty service namespaces
in the UI are not copies of the application's data.

Tests retain their configured SDK project but use independent loopback ports,
temporary configs and disposable data. Every agent suite needs its own TMPDIR,
TMP and TEMP; Storage Emulator temporary blobs can otherwise cross suites.
Never use developer snapshots for tests. Functions emulator runtime gets temporary
placeholder secrets rather than editing application secrets or fetching cloud ones.
See each repository's AGENTS.md for additional process rules.

Functions imports use redequate-server/backend/firebase-server. Server sources
are packaged separately; complete successful watch builds replace the installed
package and touch the entry point. Ordinary edits do not repack or update lockfiles.
See [server packaging](../../packages/server/README.md) for dependency changes and
manual preparation. The root deploy-functions action performs preparation/lint.

## Database Rules

The base is `packages/database/src/firebase/database.rules.json`. An optional root
`database.rules.json` supplements it. Objects merge recursively, .indexOn values
are unioned, and explicit .read/.write/.validate at the same path override the base.
Firebase inherited grants still apply: a child denial cannot revoke a parent grant.
Input and composed output are validated; invalid changes retain the previous output.
There is no application-source/provider discovery or automatic restoration of old
full policies. On a shared remote database, the supplement must represent the
combined intended policy rather than independent incomplete app policies.

Build/rules actions generate `.firebase/generated/database.rules.json`. Emulator
starts/tests use their temporary runtime Rules file. Changes to the base, project
settings and optional supplement regenerate Rules, including supplement creation
and deletion. Invalid output is not published. Firebase CLI separately reports
acceptance of generated Rules. Changing project/ports requires a restart.

The pure `resolveRules(base, {additions, overrides})` API remains conservative.
The project loader converts explicit supplement directives to overrides and
indexes/branches to additions. Query lint validators use the same composed Rules.
Run `npm run test:tooling` for generation/validation and the application's
`npm run "test emulator"` for actual access checks. No separate deploy-rules
command exists in the application workflow.
