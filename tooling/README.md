# Tooling

The supported application interface is `app.mjs --config redequate.config.json`.
Public imports: `redequate/tooling/app`, `app-config`, `vite`, `firebase-rules` and
`firebase-test`. Internal filesystem paths are not public APIs.

- `app/`: command execution, disposable Firebase runtime, build receipts, seeding
  and process ownership.
- `core-watch/`: Rollup watcher, subscriber client, lock protocol and detached bootstrap.
- `server/`: Functions package preparation and live synchronization.
- `eslint/`: query and local-store validators and their path analysis.
- `__tests__/`: tooling tests, integration runners and historical verification reports.
- `docs/`: configuration, Firebase lifecycle and Database Rules documentation.
- `migrations/`: explicit one-off migrations.

# Database query lint suggestions

`redequate/database-queries` checks statically known `read` and `cursor` paths for
explicit Local and Firebase database providers. ESLint suggestions appear on a
reported error or warning as editor quick-fix hints. They are not typing-time IDE
autocomplete and are never applied automatically.

Local suggestions use the existing `stores.json` index declarations. The first
path segment is a store name; a trailing string in an array read/cursor path is an
identity field, while named object segments are filters. `orderBy` strings and
arrays each name one field path, and suggestions keep the original form.

Firebase `orderBy` suggestions use `.indexOn` at the query node in the configured
`database.rules.json`. Rules describe access and indexes, not a complete data
schema. A missing child rule does not prove that a data field is invalid, so the
rule does not offer child-name replacements based only on missing rule nodes.
Suggestions are omitted when expressions are dynamic or the provider is unknown.

## Centralized Firebase Rules

See [Firebase and Rules](docs/firebase.md) for the framework base plus optional application database.rules.json supplement. The root redequate.config.json is the only project tooling config. Both validators default to the framework base and accept `settings.redequateDatabase.projectConfig`.

Tooling tests, the Emulator runner and verification reports live in `tooling/__tests__/`. Run them with `npm run test:tooling` and `npm run test:integration`.

## Firebase application orchestration

The common runner, Emulator configuration, process manager and seed implementation are in tooling. Applications pass root `redequate.config.json` to `redequate/tooling/app`; library-specific files remain separate. See [Firebase and Rules](docs/firebase.md).
