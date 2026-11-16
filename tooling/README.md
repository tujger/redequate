# Tooling

Applications use `node node_modules/redequate/tooling/app.mjs --config redequate.config.json`.
See [configuration, commands and Firebase lifecycle](docs/firebase.md).

Public tooling exports are `redequate/tooling/app`, `app-config`, `vite`,
`firebase-rules` and `firebase-test`. Other filesystem paths are implementation
entries, not stable package exports.

| Directory | Responsibility |
| --- | --- |
| `app/` | Commands, Firebase runtime, build receipts, seed and process ownership |
| `core-watch/` | Shared Rollup watcher, authenticated leases and detached bootstrap |
| `server/` | Functions archive preparation and live package synchronization |
| `eslint/` | Database query/index validation and suggestions |
| `__tests__/` | Tooling tests and disposable integration runners |
| `docs/` | Maintained application tooling reference |
| `migrations/` | Explicit one-off migration utilities |

Run `npm run test:tooling` for tooling unit tests and `npm run test:integration`
for framework emulator integration. Application integration tests use their root
`test emulator` command. Historical run totals are not current validation evidence.

## Query lint suggestions

`redequate/database-queries` checks statically known read/cursor paths for explicit
Local/Firebase providers. Suggestions are editor quick fixes, not automatic edits
or typing-time autocomplete. Dynamic/unknown providers do not get speculative fixes.

Local suggestions use canonical stores.json indexes: the first segment is a store,
a trailing bare segment selects collection identity, and named segments are filters.
Firebase suggestions use .indexOn at the query node; Rules are not a complete
schema and missing child rules do not prove invalid fields. Both validators accept
`settings.redequateDatabase.projectConfig` and use the shared Rules resolver.
