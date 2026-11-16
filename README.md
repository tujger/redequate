# Redequate

React application framework used by [demo](https://github.com/tujger/edeqa-pwa-react-demo)
and [The Whisky Talks](https://github.com/tujger/thewhiskytalks).

## Install and develop

Use Node.js matching [package.json](package.json) (`>=24.12.0` for the framework).
Install a published package with `npm install redequate`. For framework development:

```sh
npm ci --legacy-peer-deps
npm run "build core"
```

Consumers linked to a sibling checkout use their own start commands. The shared
launcher starts or joins the core watcher and waits for a successful build;
a second terminal running Rollup is unnecessary. For standalone framework work,
use `npm run "start core"`.

Shared React and i18next dependencies must resolve to the same physical packages.
The launcher runs `tooling/app/link-react.sh`; it can also be called manually with
an absolute consumer directory after reinstalling dependencies. Keep dependency
versions aligned with package manifests rather than copying version lists into docs.

## Application setup

Each consumer owns `redequate.config.json`, Firebase SDK JSON, `firebase.json`
(Hosting/Functions/Storage options), Storage Rules and application source.
See [tooling and Firebase](tooling/docs/firebase.md) for environments, emulator
persistence, test isolation, shared Vite/Vitest defaults and build/deploy commands.
The small [example](example/README.md) demonstrates controls without Firebase.

Use public package imports; supported subpaths are declared in
[package.json](package.json). Browser and Node server packages are separate.
Functions import `redequate-server/backend/firebase-server`, not a browser bundle;
see [server packaging](packages/server/README.md).

Create provider instances once, outside render or with stable memoization, and
pass them to Dispatcher. Dispatcher connects resolved providers through setters.
Standalone service users must connect dependencies explicitly, for example:

```js
import LocalBackend from "redequate/backend/local";
import LocalDatabase from "redequate/database/local";

const storageId = "my-local-app";
const backend = new LocalBackend({storageId});
const database = new LocalDatabase({storageId});
database.setBackend(backend);
backend.setDatabase(database);
```

Auth and Storage use the same setter-based wiring; constructor injection of
`database`, `backend` or `auth` is not a substitute. Public source types and
[development decisions](DEVELOPMENT.md) describe provider responsibilities.

## Themes and controls

```jsx
import {Dispatcher, ThemeSeason, Theme} from "redequate";

<Dispatcher theme={<ThemeSeason/>} {...props}/>;
// Custom CSS text, or use Theme's href prop for an external stylesheet:
<Dispatcher theme={<Theme css={paletteCSS}/>} {...props}/>;
```

Without a theme, Dispatcher uses the base palette. Theme mounts and removes its
stylesheet with the component. ThemeDayNight uses approximate seasonal daylight,
without location permission. CSS custom properties provide palette overrides.

Controls use CSS Modules and their supported className/style props. Applications
using MUI components own their MUI ThemeProvider. Refer to exported components and
the demo for current props; legacy JSS/classes and old fork-specific input props
are not compatibility APIs. Geoapify autocomplete requires the configured key in
meta/settings; absent a key, PlacesTextField cannot offer suggestions.

## Checks

```sh
npm test                       # unit plus framework emulator integration
npm run test:unit
npm run test:tooling
npm run test:integration
npm run test:integration:watch
npm run "test:watch core"
npm run "build core"
npm run "build server"
```

Framework emulator checks allocate temporary data, a demo project and independent
loopback ports. Java 21+ and the Firebase CLI dependencies are needed; the first
run may download emulator components. Do not stop another session to free ports.
Consumer unit, Functions and application integration suites are separate gates.
Current failures are determined by running checks, not historical report totals.
Unverified follow-ups live in [AUDIT_BACKLOG.md](AUDIT_BACKLOG.md).

## Auth

Import AuthBase/hooks from `redequate/auth`, FirebaseAuth from
`redequate/auth/firebase`, and the disposable browser simulation from
`redequate/auth/local`. FirebaseAuth accepts `{firebase, UserData?}`; LocalAuth
accepts `{storageId?, UserData?}`. Connect Auth to its database with `setDatabase`
when using it outside Dispatcher. Hooks read the nearest Dispatcher context.

Auth returns detached UserData models, not SDK credentials. Signed-out restoration
returns an anonymous model; absent redirect results return null. Constructors are
synchronous. Provider operations return Promises, await shared validation before
side effects, and preserve provider error codes. Profile registration, verification
and updates need a linked database. Roles and profile fields are persisted through
Database; authentication secrets stay with the provider.

| Method | Result |
| --- | --- |
| `onAuthStateChanged(callback, onError?)` | `Promise<unsubscribe>`; callback receives `UserData`, including an anonymous model |
| `createUserWithEmailAndPassword(email, password)` | `Promise<UserData>` |
| `signInWithEmailAndPassword(email, password)` | `Promise<UserData>` |
| `signInWithPopup(provider, options?)` | `Promise<UserData>` |
| `signInWithRedirect(provider, options?)` | `Promise<void>` |
| `resolveRedirectResult()` | `Promise<UserData \| null>` |
| `signInWithCredential(credential)` | `Promise<UserData>` |
| `sendSignInLinkToEmail(email, options?)` | `Promise<void>` |
| `checkSignInWithEmailLink()` | `Promise<boolean>` |
| `signInWithEmailLink(email)` | `Promise<UserData>` |
| `sendEmailVerification(options?)` | `Promise<void>` |
| `sendPasswordResetEmail(email, options?)` | `Promise<void>` |
| `resolveCurrentUser()` | `Promise<UserData>`; anonymous model when signed out |
| `updatePassword(password)` | `Promise<void>` |
| `updateProfile({public?, role?, private?})` | `Promise<void>` |
| `signOut()` | `Promise<void>` |

`updateProfile` writes supplied public/private/role sections to the established
profile paths; omitted sections remain unchanged. Database Rules authorize writes.
Token access for backend requests belongs to Firebase integration, not UserData.
See [AuthBase](packages/auth/src/AuthBase.ts) for option types and current signatures.

LocalAuth stores accounts, sessions and simulated mail in IndexedDB. Passwords and
simulated tokens are plain text: use disposable credentials only. Verification,
email links and provider logins are simulations and send no email. Provider options
are recorded or ignored according to the Local implementation, not authenticated
against Google/Facebook. Real provider delivery and popup flows need separate checks.

## Local data

Local Database/Auth/Storage/Messaging share an IndexedDB database when their
`storageId` values match; the default is `redequate:local`. Explicit IDs are used as
supplied. `$`-prefixed stores are provider-owned and unavailable as application
collections. Providers prepare their own service schema; LocalDatabase prepares
application stores/indexes. Preserve existing developer data during schema changes.

LocalBackend implements prepared CRUD and observer delivery after commit. Queries
use declared indexes; Firebase and Local address adaptation differ intentionally.
Do not assume a Firebase string path is a valid indexed Local record address.
Use the [Database/Cursor contract](packages/database/src/common/CONTRACT.md) and
source types for read/update/delete, scalar values, query bounds and subscriptions.
Old physical formats are not silently migrated or deleted.

## Cursors

### Composition

`database.cursor()` accepts a path or a non-empty array containing source
descriptions (`{path, ...options}`), fresh `DatabaseCursor` implementations, or
both. A ready cursor can itself be a composition. Ready cursors must extend
`DatabaseCursor`, retain their own selection options and handlers, and must be
consumed exclusively by their composition. Source-description options override
outer options; outer selection options do not reconfigure ready cursors.

Each source is read through `next(n)` using the current requested page size.
Composition buffers these results and alternates sources one entry at a time.
An exhausted source remains available until its buffer is consumed. A changed
page size applies when a buffer next needs filling. Duplicate results are removed
by normalized collection `path` plus `key` for the composition's lifetime.
Different collections may return the same key.

Set `group: "Title"` on a cursor or source description to emit one heading
`{key, value: {group: "Title"}}` before its first result. Headings have no `path`;
ordinary cursor entries always have one. Empty groups emit no heading. A plain
cursor uses its normalized collection path as the heading key; a composition
uses its cursor id. A composition's own group wraps its results and is not
inherited by its sources. Ready implementations expose their optional `group`
and return their own heading.

If any source has a group, including nested built-in compositions, results are
returned as whole source blocks in source order rather than interleaved. Each
active source receives `next(n)` once per call, so the total may exceed `n`, plus
headings. Headings count toward `count` and `position.index`, but not the requested
data page size. They are not passed to `handle` or emitted by subscriptions.

Source `handle` callbacks run during source reads, before composition buffers
results. Consuming a buffer does not invoke `handle` again. Independent cursors
may each handle the same record; composition only deduplicates their results.
Subscription events are forwarded without deduplication. Unsubscribing a
composition only removes the subscriptions it created.

```ts
import {DatabaseCursor} from "redequate";
// The same class is available from "redequate/database".

class CustomCursor extends DatabaseCursor {
    // Implement next(n); override subscribe(listener) only for live sources.
    // Use this._count and this._position to maintain inherited metadata.
}

const cursor = database.cursor([
    {path: ["users_public"], orderBy: ["_sort_name"], start: filter},
    customCursor, // extends DatabaseCursor
]);
```

`DatabaseCursor` stores cursor options and exposes them through getters, alongside
id, path, count and position. Its constructor accepts options and an optional source
path; without a path, the cursor id is used for its heading. Base `next(n)` validates
the size and returns an initial array containing the group heading once, or `[]`.
It counts the heading and advances position; subclasses append up to n data entries
and account for those entries separately. Base `subscribe(listener)` only validates
the listener and returns undefined; static cursors need not override it. A composition accepts instances
using `instanceof DatabaseCursor`, so subclasses must extend the constructor
exported by the same installed package and module format. Separate package copies
or mixing ESM and CommonJS constructors can fail this check.

The server archive also exports DatabaseCursor from its root and provides
`redequate/database`, `redequate/database/firebase` and `redequate/database/local`.
The class lives in `packages/database/src/common/DatabaseCursor.ts`; common stays
independent of database. Public declaration files are no longer generated or
published; TypeScript contracts remain in source.

### Pages cursor

```js
import {PagesCursor, normalizeSortName} from "redequate";

const pages = new PagesCursor({
    group: "Pages",
    orderBy: ["_sort_name"],
    start: normalizeSortName(filter),
});
const entries = await pages.next(10);
```

PagesCursor reads the registered application pages, skips dynamic routes and checks
the current user's roles while reading. Entries have `path: "pages"` and
`value: {route, name}`. Query fields come from page definitions; `_sort_name` is
computed from the label or title without changing the page. Ordering, inclusive
start/end bounds, prefix search and equalTo follow cursor query semantics. With no
bounds, all eligible pages are returned. Handle and date bounds are unsupported.
It has no live subscription implementation. PagesPagination remains available.
Empty group headings are filtered by composition after traversal and deduplication.

## Further reference

- [Database/Cursor behavioral contract](packages/database/src/common/CONTRACT.md)
- [Functions server package and backend operations](packages/server/README.md)
- [Tooling overview](tooling/README.md)
- [Current architectural decisions](DEVELOPMENT.md)
- [Development rules](AGENTS.md)

MIT © [tujger](https://github.com/tujger).
