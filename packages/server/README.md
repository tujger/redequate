# Redequate Server for Functions

`redequate-server` is a private Node.js 22+ package with ESM and CommonJS exports.
Install its archive as `redequate-server@file:vendor/redequate-server.tgz`.

## Build and dependencies

Install development dependencies at the Redequate root. In `packages/server`,
run `npm run build` for the aggregate build or `npm run watch` for rebuilds when
imported sources or dependency manifests change.

The same commands in `packages/backend/src/{common,firebase}-server` build
only that Backend, using the root toolchain. Each Backend has an isolated output
under `packages/server/dist/backend`; shared outputs are cleaned separately.

Backend manifests are the source of runtime dependencies. The build merges them
into `dist/package.json`, rejects conflicting versions, and leaves dependencies
external. Consumer lockfiles pin installed versions; the server has no lockfile.
Nested manifests contain only module type, runtime dependencies and build/watch
commands. They do not define independently installed or published npm packages,
and require no separate installs or lockfiles.
Browser builds reject Node Backend sources; server builds reject browser and UI sources.
LocalBackend creates records directly in prepared browser IndexedDB stores; it is shipped by `redequate`, outside this Node archive.
LocalDatabase is available through `redequate/database/local` in the browser; it is not included in this Node package.

Supported entry points:

- `redequate-server/common`
- `redequate-server/database`
- `redequate-server/backend/common`, `/backend/common-server`
- `redequate-server/backend/firebase-server`

Use explicit subpaths; the package has no root entry point. `DatabaseCursor` is
exported by `/database`. Server `resolveDatabase` requires an explicit database instance; it has no LocalDatabase fallback. Constructors from different packages or formats have
distinct `instanceof` identities.
Public declaration files are not generated.

## Firebase database.create

Initialize the default Firebase Admin app in the consuming Functions application,
then export the callable group:

```js
export {database} from "redequate-server/backend/firebase-server";
```

Importing the entry point does not initialize Firebase. The callable uses the
consumer's configured database; `FIREBASE_DATABASE_EMULATOR_HOST` selects the emulator.

The Firebase Backend client maps `request("database.create", {path, value})` to
`database-create`. The path follows the database create contract: a collection
followed by a key field name, or a named explicit key. `value` is a record object;
callbacks are unsupported. Success returns the permanent string key without
adding fields to the record.

The handler allocates a push key when necessary and creates through REST with
`If-Match: null_etag`. It forwards the caller's ID token; unauthenticated calls
use `auth=null`. Security Rules check the write atomically, including validation.
Conditional create requires read and write permission, like SDK transactions.
Existing records are preserved. Errors use `permission-denied`, `already-exists`,
`invalid-argument`, or sanitized callable errors for other failures.

## Firebase database.update

The `database` callable group also exports `update` as `database-update`.
`request("database.update", path, changes)` performs a shallow PATCH, including
multi-location keys; batches use the root path. The client adapter returns
`undefined` once that write is confirmed.

Synchronous update callbacks execute in the client adapter. It obtains a snapshot
with `request("database.update", path, null, {mode: "read"})`, returning
`{value, etag}`, then sends the callback result using
`request("database.update", path, value, {mode: "replace", etag})`.
Conditional PUT returns `{committed: true, value}` with resolved server values.
A conflicting write returns `{committed: false, value, etag}` for another callback
attempt, up to 25 attempts with bounded jittered backoff. Null/undefined callback
results delete the value. Callback exceptions and Promise results prevent writes.

All reads and writes forward the caller's ID token to preserve Security Rules.
Patch needs write access; callback updates need both read and write access.
The public `database.update` overloads and error handlers are unchanged.

## Firebase database.delete

`request("database.delete", path)` invokes `database-delete`. The single path is
sent directly as the callable payload, without an argument-array wrapper.
The Firebase database adapter resolves its path and routes deletion through its
injected Backend or the default FirebaseBackendClient. REST DELETE forwards the
caller's ID token so Security Rules authorize the write; read access is not needed.
Deletion is unconditional and also succeeds for absent data when Rules allow it.
Root paths are supported. The callable returns `null`; the client adapter returns
`undefined` after confirmation and preserves the existing `onError` handling.

## Prepare the Functions archive

```sh
node /path/to/redequate/packages/server/prepare-redequate-server.mjs /path/to/application/functions
```

Preparation requires Node.js 24.12+, the framework checkout, and root build tools.
It builds, packs `vendor/redequate-server.tgz`, and installs it as `redequate-server`,
refreshing lockfile integrity. The uploaded archive and its runtime dependencies
install without a sibling checkout. Run `npm run pack` in `packages/server` to
build and pack the standalone `dist` directory directly. Pack `dist`, which contains
the generated runtime manifest, rather than the source package directory.


## Live updates in Functions Emulator

After preparing the archive once, run this alongside an existing emulator:

```sh
node /path/to/redequate/packages/server/watch-redequate-server.mjs /path/to/application/functions
```

The Whisky Talks starts this watcher automatically with `npm run start:emulator`.
To attach it to an already running session, run
`npm --prefix functions run watch:redequate-server` in that application.
Only one watcher can own a Functions directory at a time.

The watcher builds imported server sources and manifests in a private temporary
output directory. After a complete successful build it replaces the installed
`redequate-server` package, then touches the Functions entry point to request a
reload: Firebase ignores changes under `node_modules`. Syntax errors preserve
the last installed build; correcting them resumes synchronization. Stopping the
watcher leaves that last build installed and removes its temporary files.

Ordinary edits do not update the archive or lockfile. If runtime dependency
requirements change, synchronization pauses: stop the watcher, run
`prepare-redequate-server`, then start it again. Prepare the archive before deploy;
live updates are a local development path, not a replacement for packaging.
