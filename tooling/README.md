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

See [FIREBASE_RULES.md](FIREBASE_RULES.md) for composition, static provider argument extraction, CLI generation, shared databases and consumer migration patches. Both validators default to the framework base and accept `settings.redequateDatabase.rulesConfig`.

Tooling tests, the Emulator runner and verification reports live in `tooling/__tests__/`. Run them with `npm run test:tooling` and `npm run test:integration`.

## Firebase application orchestration

The common runner, Emulator configuration, process manager and seed implementation are in tooling. Applications provide `firebase.config.mjs` and invoke the common CLI directly. See [FIREBASE.md](FIREBASE.md).
