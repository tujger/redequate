# Project tooling: one JSON configuration

Each application has one root `redequate.config.json`. All project settings owned
by Redequate live there. No JavaScript config factory, provider manifest, manually
maintained emulator SDK config or framework settings in `.env` are required.

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

Paths resolve relative to the JSON, regardless of the shell working directory.
Remote project IDs are read from the referenced Firebase SDK JSON. The emulator may reference its own SDK JSON with environments.emulator.firebaseConfig;
that file takes precedence and is read unchanged, including projectId. Without it, optional
sourceEnvironment selects an existing remote environment; otherwise defaultEnvironment
is used. No separate emulator SDK configuration is generated.
`mode` can preserve a library mode name such as `server-dev` within one environment.
There are no separate project/mode/configuration mapping tables.

## Settings and defaults

- `server`: port 3000, host `0.0.0.0`, HTTPS true, empty allowedHosts, polling false,
  cert `server.crt`, key `server.key`. Custom paths and values belong in this object.
- `environments.<remote>`: `firebaseConfig`, optional `mode` (defaults to the key).
- `environments.emulator`: optional firebaseConfig (SDK JSON path), sourceEnvironment, mode, portOffset (0), individual
  `ports` overrides, readyCallable, region (`us-central1`) and seed.
- `testing`: optional file (`scripts/__tests__/emulator.test.mjs`) and unitEnvironment (otherwise defaultEnvironment).

Default emulator ports: Auth 9099, Database 9000, Functions 5001, Storage 9199,
Hub 4400, UI 4000, Logging 4500, Eventarc 9299, Tasks 9499. portOffset applies to
all of them; isolated tests add 10000 and disable UI. Services listen on loopback.
Project settings in HOST/PORT/HTTPS/SSL_* or polling environment variables do not
override this JSON. `--http` and `--https` select a protocol for a single invocation.
Environment variables for library secrets remain separate; never commit real secrets.

Optional seed has `accounts` (localId, email, displayName, role) and password.
It is restricted to the expected SDK project ID and strictly loopback endpoints. An existing seed marker
prevents reinitializing persisted developer data. Optional readyCallable must reject
an anonymous empty request with 401/UNAUTHENTICATED; otherwise readiness checks the
four registered services. Seeding, SDK file selection and test isolation
all consume this same resolved context.

## Commands

```sh
node node_modules/redequate/tooling/app.mjs --config redequate.config.json start emulator
node node_modules/redequate/tooling/app.mjs --config redequate.config.json start remote --http
node node_modules/redequate/tooling/app.mjs --config redequate.config.json build remote
node node_modules/redequate/tooling/app.mjs --config redequate.config.json preview
node node_modules/redequate/tooling/app.mjs --config redequate.config.json test emulator
node node_modules/redequate/tooling/app.mjs --config redequate.config.json test-unit remote
node node_modules/redequate/tooling/app.mjs --config redequate.config.json rules
```

Web deployment is explicit: `deploy-hosting` without an environment publishes the
last confirmed build. It never rebuilds. `preview` also uses that same artifact.
After successful build, build/.redequate-build.json records the environment/project
and hash of build/.redequate-rules.json, the prepared Rules snapshot. A new build
invalidates the previous receipt before compilation; failed builds cannot be served
or deployed. Missing/corrupt receipts, a changed Rules snapshot or a project mismatch
require rebuilding. These are generated build outputs, not configuration files.

The web deploy pipeline publishes the snapshot Database Rules first, then Hosting.
Rules failure prevents Hosting publication. Neither source Rules nor Vite are rerun
at deploy time. Both hidden metadata files are excluded from Hosting content.
Functions remain separately deployed with `deploy-functions <environment>`;
preparation and lint run before that explicit action. There is no separate
project deploy-rules action. Other commands do not publish anything.

The runner configures Vite, PWA, provider SDK routing, Rules and emulator lifecycle.
Generated configs are implementation artifacts, not additional manual settings.

## Library-specific files

Keep Firebase SDK JSON, Storage Rules, Hosting rewrites, ESLint and Vitest settings
in their own library formats. A `vite.config.mjs`, when needed, exports only Vite
customizations such as `define`, sourcemaps or extra plugins. Project server fields
in that file are rejected; most applications need no local Vite config.
The default output is `build`, used by Hosting. The runner preserves application
Hosting and Storage settings while supplying generated Database and emulator sections.
The source `firebase.json` must not duplicate those framework-owned sections.

The runner uses its own Vite entry. Vitest can integrate library-specific settings
with `createProjectViteConfig(configFile)` from `redequate/tooling/vite`; it returns
an async config callback. Unit tests need no local HTTPS certificates. Browser and messaging worker sources use ordinary JSON imports: demo reads its
existing ./firebase-config.json; TWT uses a file alias to the selected existing
variant. No SDK JSON or its fields are rewritten, including in tests. The optional
endpoint artifact .firebase/generated/emulators.json contains only public local
service endpoints. It is generated from the project JSON, not manually configured.
There is no virtual runtime module. Analytics is disabled explicitly in emulator
mode without altering the SDK configuration.


## Rules and lifecycle

Rules composition uses the framework base and optional root `database.rules.json`.
There is no provider list or application-source execution/extraction in this flow.
Builds and the rules action write
`.firebase/generated/database.rules.json`; emulator starts and isolated tests use
runtime-owned Rules files. Appearance, edits and deletion of the optional supplement
are watched. Invalid changes retain the previous generated Rules and report an error.

The runner owns the core lease, Rules watcher, server watcher, Vite and emulator
processes. Core compilation must be ready before development services start.
Developer data lives in `.firebase/emulator-data/<projectId>`; graceful shutdown waits for export.
Test ports, generated configs and data are isolated in short temporary
paths, then removed. Test helpers receive this context from the runner rather than
hardcoding project IDs or endpoints. Local email and push handlers use emulator
behaviour instead of real SMTP/FCM; browser FCM is replaced with LocalMessaging.

The core watcher is shared by canonical checkout. Each launcher disconnects after
its own app teardown. The daemon stops five seconds after its last subscriber;
a manual `start core` remains alive without apps. Incompatible live locks require
one manual restart, never forced deletion. Diagnostics remain in ignored node_modules.

Tests keep the original SDK project ID and all SDK fields, using separate local
ports and temporary data, never importing a developer snapshot. Historical
snapshots with another ID are not automatically imported or removed. Emulator
Functions receive temporary placeholder Gmail secrets so registration does not
fetch cloud secrets. This source directory and its local secret file are disposable;
application Functions sources are not modified.

Only the root project JSON is accepted; the former JS config runner and provider
manifests are no longer supported.

Verification and remaining consumer gaps: [report](../__tests__/PROJECT_JSON_REPORT.md).

# Database Rules

## Base plus optional supplement

Redequate owns the common base in `packages/database/src/firebase/database.rules.json`.
The runner checks for an ordinary Firebase `database.rules.json` beside the project
JSON. If absent, the base is used unchanged. If present, it is a supplement:

```json
{
  "rules": {
    "appRecords": {".read": "auth != null", ".indexOn": ["created"]}
  }
}
```

Objects merge recursively. `.indexOn` values are unioned without duplicates.
Explicit `.read`, `.write` and `.validate` directives in the supplement take
precedence at the same path. Firebase's own inherited-grant semantics still apply:
a child denial does not revoke a grant on its parent. The input and combined Rules
are validated; a malformed document fails generation without replacing prior output.
The supplement is never modified or overwritten by the generator.

```sh
node node_modules/redequate/tooling/app.mjs --config redequate.config.json rules
```

Builds generate `.firebase/generated/database.rules.json`. Emulator starts and
isolated tests generate into their disposable runtime configurations. None of these
operations deploys Rules. Web build captures the generated Rules in its artifact. The explicit Hosting
deploy action publishes that exact snapshot before Hosting, without regeneration.
There is no separate Rules deployment command in the application workflow. Existing app Rules files must be reviewed as
supplements; do not restore retired full policies automatically during migration.

## Watching and consumers

The watcher subscribes to the base, project config, library inputs and supplement
path even if the supplement does not exist. Creating, changing or deleting that file
regenerates Rules. Errors retain the last valid artifact; correcting a source resumes
generation. Firebase CLI compilation/acceptance is reported separately by the CLI.
Changing project environments, ports or other startup settings requires a restart.

Demo and The Whisky Talks use this flow and retain their own Storage Rules and
Hosting-specific configuration. Their current missing supplement means the common
base, including public `_activity` reads and participant-only mutual-request rules.
On a shared database, the optional supplement describes the database's combined
application policy; deploying independent incomplete policies is not supported.

The ESLint query/index validators use the same Rules loader. They discover a root
`redequate.config.json` from the application cwd or use the runner's resolved config
path. An explicit `projectConfig` setting can supply that same JSON when invoked
from elsewhere. This is a reference to the one project config, not another policy.

## Programmatic Rules API

The pure `resolveRules(base, {additions, overrides})` API remains conservative for
existing programmatic users. The project supplement is explicit application policy;
the loader converts its access/validation directives to overrides and its indexes
and branches to additions. Provider manifests and extraction from application source are no longer supported.

Tests cover base-only resolution, supplements, atomic output, appearance/deletion,
indexed queries, validation and actual emulator access. See `npm run test:tooling`
and each application's `npm run "test emulator"`.
