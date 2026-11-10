# Single project JSON and immutable SDK imports

The web consumers now use root redequate.config.json through tooling/app.mjs.
Their former JS tooling configs and Rules provider manifests are removed. Library
SDK JSON files remain unchanged. Demo App.js and messaging worker import the same
./firebase-config.json; TWT uses a file alias to its selected existing variant.
There is no virtual runtime module. Only public local endpoints are generated as
.firebase/generated/emulators.json. SDK configuration is not synthesized or altered.

## Verification

- 99 tooling tests passed, including optional Rules creation/deletion, atomic
  generation, project config validation, shared watcher and shutdown isolation.
- 12 Firebase/browser-helper tests passed, including immutable SDK initialization
  and Analytics suppression across reinitialization.
- Final demo and TWT dev builds passed, including messaging workers and PWA output.
- HTTP and HTTPS returned 200 for both applications on ephemeral verification
  ports with normal certificate validation. Transformed App.js contains no virtual
  runtime import. This does not establish visual browser/device verification.
- SHA-256 values for demo and both TWT SDK JSON files matched their snapshots after
  implementation and testing. No source SDK field was changed.
- Demo emulator suite: 3 passed. It used the original edeqa-pwa-react-demo project
  ID, separate loopback ports and disposable data. SDK database namespace is taken
  from the original databaseURL. Temporary Gmail placeholders prevent Secret
  Manager lookups during local registration; no application secret file is edited.
- TWT emulator suite: 4 passed, 4 failed, with the same failure cases observed in
  the preceding generated-config run before immutable-SDK correction. The suite
  started successfully with the original dev SDK project and separate local ports.

## Existing application-contract gaps

TWT emulator failures are:

1. Notification test expects per-token results; the handler currently returns null.
2. Activity test expects removal of the legacy types record; the current handler
   retains it.
3. Post-edit test uses legacy constructor backend injection for one Database
   instance; its TIMESTAMP access has no linked backend.
4. Scalar increment test expects an update shape rejected by the current callable.

These assertions and backend contracts were not changed by project tooling work.
Separately, TWT has four failing Profile unit assertions, also reproduced with the
previous Vite config; 24 other unit tests passed in the earlier comparison. The
new JSON-aware Vitest runner produces the same Profile failures. They need their
own application/framework compatibility work.

The emulated friend-request scenarios also emit background handler timestamp
errors despite passing their Rules assertions; passing tests do not establish
that all asynchronous application handlers are healthy.

An orphaned Database Emulator from our interrupted legacy baseline occupied port
19000. Its cwd was verified as the exact baseline temporary directory before only
that PID was terminated. User development servers and the existing shared core
watcher were not terminated. No old snapshot was deleted or automatically imported.
No cloud deployment or remote application-data migration was performed.
