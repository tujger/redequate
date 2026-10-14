# Redequate Server for Functions

This private package builds common and server backend sources into an independent
`redequate-server` archive for Node.js 22+. The main `redequate` package contains
common and client modules; server modules are available only from this archive.

Install the root development dependencies, then run `npm run "build server"` at
the repository root, or `npm run build` in this directory. Output is written to
`packages/server/dist`. Running `npm pack --pack-destination /path/to/vendor`
here also builds the package through its prepack hook.

Install the archive under the `redequate` dependency name to retain existing
Functions imports. Both ESM `import` and CommonJS `require` support:

- `redequate/common`
- `redequate/backend/common`
- `redequate/backend/common-server`
- `redequate/backend/firebase-server`
- `redequate/backend/local-test-server`

The root export is an alias for common. Client entry points are not exported.
The browser build rejects server sources; this build rejects client and UI
sources. Node builtins and declared runtime dependencies, including their
subpaths, remain external to the bundle and are installed by npm.

`firebase-admin` is installed as a runtime dependency for Firebase server code;
it is not embedded in the bundle. The backend entries are currently empty.
Common imports do not initialize Firebase. The build tools come from the
repository root and are not shipped to Functions.

The Whisky Talks keeps its `prepare-redequate-server` command, which builds this
package, packs it as `vendor/redequate-server.tgz`, and reinstalls it to refresh
lockfile integrity. The uploaded archive and its declared dependencies are
sufficient for installation without the sibling Redequate checkout.
