# Discover publication runtime investigation — 2026-10-23

Archived investigation: temporary runtime instrumentation and its dedicated test
have been removed after successful verification. Trace event names, diagnostic
file references, and line numbers below describe the captured revision. The
publication navigation correction and its regression tests remain in the code.

## Result and limits

The reported Firebase-versus-Local refresh difference was **not reproduced** in
Chrome at `https://localhost:3000/discover` with the current development checkouts.
Before the correction, both providers saved the root post, remained on Discover
with its old list, and displayed the post after My feed → Discover. No causal
provider divergence was observed. The original differential cause remains unproven.

A shared publication-navigation defect was reproduced and corrected: the
completion callback attempted navigation before React committed the modal close.
The modal's history blocker rejected the push. This is proven by the matching
browser sequences, the blocker implementation, and regression tests which failed
with both adapters before the correction and pass afterward. The tests also cover
returning to Discover and reading/rendering the new post with `live=false`.

The corrected publication flow was subsequently verified in the running browser
with both providers. After explicit approval for one additional post per provider,
Firebase navigated to its new post at 16:10:52 UTC and Local at 16:12:03 UTC.
Both completion callbacks observed `modalOpen: false`; returning through Home and
the Discover tab created fresh cursors and displayed the new posts. Neither run
received a discover child event or dispatched Layout.REFRESH during this flow.

Automatic approval review had rejected an earlier additional Local post; that
block was resolved by the user's explicit follow-up authorization. Exactly one
additional root post was published per provider in the follow-up. All four posts
created by this investigation were retained; no deletion was authorized.

## Prior task and environment

Task `32f309d1-8290-4852-ae09-b0b712c37c37` reported `completed`, exit code 0.
It installed opt-in instrumentation but had captured no browser reproduction.
Its instrumentation was reused, with the additions described below.

Redequate, The Whisky Talks, and the demo were on
`story/move-database-to-module`. The Whisky Talks initially selected Firebase
and had a signed-in session. Its existing Local imports were temporarily selected;
the empty Local database was signed in through LocalAuth's simulated Google login.
The providers therefore used different identities and datasets, a limitation when
trying to reproduce notification behavior tied to a particular Firebase user.
The initial Firebase list contained ten loaded rows; Local initially had none.

Temporary Home, Discover, and NewsFab logs observed navigation attempts, actual
component effects, and callback branches. These four app files, including App.js,
were restored byte for byte from saved originals. The app checkout is clean.
The diagnostic flag was disabled before restoration. No commits, pushes,
deployments, production rule changes, or architectural migrations were performed.

## Comparative browser traces

These are selected event excerpts from the captured console stream, with UTC
timestamps and the existing masked identifiers. Duplicate physical/composed
cursor events and transformations of older posts are omitted where noted.

| Event | Firebase | Local |
| --- | --- | --- |
| Root `create()` completed, numeric `to: 0` | 12:55:28.386, key `20:0d97a267` | 12:57:38.611, key `1:340ca71c` |
| NewPost completion | 12:55:28.386 | 12:57:38.612 |
| Home attempted `history.push(post route)` | 12:55:28.386 | 12:57:38.612 |
| Immediate result | Still Discover; old list | Still Discover; old list |
| Publication-triggered `discover/<uid>` callbacks | None observed | None observed |
| Publication-triggered `Layout.REFRESH` | None observed | None observed |
| User selects My feed | 12:55:36.850, route `/myfeed` | 12:57:49.982, route `/myfeed` |
| Actual Discover component unmount | 12:55:36.865 | 12:57:49.992 |
| Old list detaches | 12:55:36.866, cursor `36:8f0b5449` | 12:57:49.992, cursor `36:a42da16e` |
| User returns to Discover | 12:55:37.200, route `/discover` | 12:57:50.233, route `/discover` |
| New composed/physical cursor creation | 12:55:37.203, `36:3e69f826` / `36:f13d89b8` | 12:57:50.235–.236, `36:57cd962a` / `36:581b6cf1` |
| List attaches, `live: false` | 12:55:37.212 | 12:57:50.242 |
| Actual Discover component mount | 12:55:37.212 | 12:57:50.243 |
| Listener registration | 12:55:37.213, provider `firebase` | 12:57:50.243, provider `local` |
| Composed/physical `next(10)` | 12:55:37.220 / .221 | 12:57:50.248 / .249 |
| Cursor result and first page | 12:55:37.263, 10 rows, new key first, `stale: false` | 12:57:50.253, 1 row, new key present, `stale: false` |
| New post transformation succeeds | 12:55:37.362 | 12:57:50.258 |
| UI assertion | Diagnostic post visible | Diagnostic post visible |

The earliest provider capability difference is listener registration: Local rejects
`discover/<uid>` as an unsupported collection and reports a listener error;
Firebase accepts the RTDB address. This did **not** cause a refresh difference in
this run: Firebase delivered no child events on the path. There is no evidence
here identifying an external writer, and none was invented.

One `Layout.REFRESH` was observed at 12:57:07.957 during simulated Local login,
with callers `dispatcherRoutedBodyReducer → combination → Object.dispatch →
refreshAll`, before the publication. It was followed by Discover mounting at
12:57:07.993. It is not a post-publication refresh.

## Live verification after the correction

The follow-up used the existing Firebase and simulated Local sessions, with no
new account creation. Times below are UTC on 2026-10-23. These are selected actual
console events. The Firebase key is `20:48b02a36`; Local is `1:370cabd5`.

| Event | Firebase | Local |
| --- | --- | --- |
| `post.create.completed`, `to: 0` | 16:10:52.788 | 16:12:03.365 |
| `post.onComplete` | 16:10:52.788 | 16:12:03.366 |
| Home callback, `modalOpen: false` | 16:10:52.794 | 16:12:03.368 |
| Route becomes `/post/:key` | 16:10:52.795 | 16:12:03.368 |
| Callback returns on post route | 16:10:52.795 | 16:12:03.369 |
| Actual Discover unmount | 16:10:52.802 | 16:12:03.372 |
| Old list detaches | 16:10:52.803 | 16:12:03.372 |
| Post transformation succeeds on post page | 16:10:52.896 | 16:12:03.379 |
| After Home, explicit Discover tab selection | 16:11:19.142 | 16:12:13.230 |
| Fresh composed/physical cursor creation | 16:11:19.145, `36:77abdf87` / `36:b17ca770` | 16:12:13.233, `36:3980bfb3` / `36:d42c17f3` |
| New list attaches with `live: false` | 16:11:19.154 | 16:12:13.239 |
| Actual Discover mount | 16:11:19.154 | 16:12:13.240 |
| `discover/<uid>` listener registration | 16:11:19.155 | 16:12:13.241 |
| Composed/physical `next(10)` | 16:11:19.161 / .162 | 16:12:13.246 / .247 |
| New cursor result, `stale: false` | 16:11:19.214, 10 rows, new key first | 16:12:13.255, 2 rows, new key first |
| New post transformation in Discover | 16:11:19.265 | 16:12:13.260 |
| Browser UI assertion | New post visible | New post visible |
| `discover.listener.childAdd`, NewsFab callback, `Layout.REFRESH` | No events in the publication/return window | No events in the publication/return window |

The first meaningful before/after difference is that Home's navigation now
succeeds immediately after completion: the modal is already gone, the route
changes, and Discover unmounts. This establishes the shared fix in both real UI
runs. It does not establish a provider-specific causal difference.

All temporary instrumentation and provider imports were again restored byte for
byte to their current originals, including the intervening user commits. The
shared diagnostic flag was disabled before restoration.

## Proven shared defect and smallest correction

- `thewhiskytalks/src/pages/Home.js:110` uses NewPost's completion callback to
  call `history.push` at line 111.
- `src/components/NewPostComponent/NewPostComponent.js:212` runs publication
  completion in a promise chain. Previously it scheduled `open: false` and
  `ready: false`, then called `onComplete` before that close committed.
- `src/components/NewPostComponent/Wrapper.js:10` renders ModalComponent for
  the non-inline composer.
- `src/components/ModalComponent.js:54` registers a history blocker that
  returns false; its effect cleanup at line 60 releases the blocker.
- With React's batched updates, the modal was still mounted during Home's push.
  Thus Discover remained mounted, retaining its cursor and rows with `live=false`.
- The correction at `NewPostComponent.js:222` commits the existing close update
  using `flushSync` before invoking `onComplete` at line 231. Modal cleanup releases
  its blocker first. The normal post route can then open, and returning to Discover
  creates a fresh cursor. There is no timer, forced refresh, or database condition.

This correction repairs the shared failure seen in these checkouts. It does not
prove why a different Firebase run previously refreshed immediately.

## Changes made by this investigation

- `src/components/NewPostComponent/NewPostComponent.js:4,222`: import flushSync
  and commit the composer close before the completion callback.
- `src/__tests__/components/NewPostNavigation.test.js:49`: provider-parameterized
  regression using real NewPost, Modal, Router, and LazyList; real LocalDatabase
  and FirebaseDatabase with the existing controlled SDK fixture. It verifies root
  storage, post navigation, modal removal, and rendering after returning to Discover.
  Firebase SDK fixture responses are not a live Firebase browser validation.
- `packages/database/src/common/discoverDiagnostics.js:29,45`: serialize trace
  details so the browser log reader retains them; recognize Discover cursors.
- `packages/database/src/common/DatabaseCursor.ts:61,83`: opt-in masked cursor
  creation and next-call records, including composed and physical cursors.
- `src/components/LazyListComponent/LazyListComponent.js:89,127`: correlate
  returned pages, report stale results, and name cursor effect events attach/detach.
  The former mount/unmount labels could misleadingly imply a component remount
  when only the cursor prop changed.
- `packages/database/src/__tests__/common/discoverDiagnostics.test.js:58`:
  serialized trace checks, opt-in silence, and cursor-identity masking.
- `packages/database/src/__tests__/common/discoverPostScenario.js:2` and
  `packages/database/src/__tests__/firebase/FirebaseDatabase.integration.test.js:10`:
  let the emulator scenario use its already-permitted `database_test` collection.
  The old hardcoded `posts` path caused `permission_denied` in the existing test.
  `src/__tests__/fixtures/database.rules.json:37` adds the `to` index to that test
  collection; production rules are untouched.
- `DEVELOPMENT.md`: persistent findings and the verification limit.

All other pre-existing edits were retained. No direct Material UI icons, ripple
behavior, public database API, wire format, authentication rule, URL shape, or
Android contract was changed. The web callback now observes the composer closed
before it runs. Existing React 18/19 peer support includes flushSync; both web
consumer builds passed. Android itself was not executed.

## Verification

Node 24.21.0 was used. The shell initially selected Node 20, which could not load
the installed jsdom dependency; that failed launch ran no tests and was rerun
with the repository-supported Node version.

| Check | Result |
| --- | --- |
| Navigation regressions before correction | Both fail: `/discover` remains after saved root and completion callback |
| Navigation regressions after correction | 2/2 pass, including fresh Discover cursor and visible row on return |
| Full Redequate unit suite (prior run) | 926/942 pass; same 16 failures as pre-change 923/939 baseline |
| Firebase emulator suite (prior run) | 93/93 pass after correcting test collection |
| The Whisky Talks suite | 17/18 pass; same existing `Profile.test.js:66` undefined `onChange` subscription failure |
| Redequate build | Pass; existing `use client`/empty chunk warnings |
| The Whisky Talks build | Pass against the corrected local library |
| Demo build | Pass against the corrected local library |
| `git diff --check` | Pass |
| Live browser before correction | One root publication per provider; post visible on tab return in both |
| Live browser publication after correction | Passed for both providers: post route opens; return to Discover displays new post |
| Browser smoke after restoration | Earlier timeout resolved on a fresh tab; Firebase diagnostic post visible and no console errors |

Build outputs were directed to `/private/tmp/thewhiskytalks-discover-final-build`
and `/private/tmp/edeqa-demo-discover-final-build`; framework output is ignored
`core/`. Full logs are in `/private/tmp/discover-framework-final-unit.log`,
`/private/tmp/discover-framework-integration.log`,
`/private/tmp/discover-app-final-tests.log`,
`/private/tmp/redequate-discover-final-build.log`,
`/private/tmp/discover-app-final-build.log`, and
`/private/tmp/discover-demo-final-build.log`. The original failing navigation
regression output is `/private/tmp/discover-navigation-before.log`.
Follow-up logs are `/private/tmp/discover-postfix-target-tests.log` (5/5),
`/private/tmp/discover-postfix-app-tests.log` (17/18),
`/private/tmp/discover-postfix-core-build.log`,
`/private/tmp/discover-postfix-app-build.log`, and
`/private/tmp/discover-postfix-demo-build.log` (all three builds pass).

## Remaining evidence for the historical differential

The corrected route-driven publication/return flow is now verified in the live
browser for both providers. The follow-up targeted tests also pass 5/5 across
NewPostNavigation and discoverDiagnostics. After core finished rebuilding, the
application suite again produced 17 passes and the same Profile failure; core,
The Whisky Talks, and demo builds all passed. An initial overlapping app test
launch ran no tests because core was being recreated; its result was discarded
and the suite was rerun after the build. The previous full framework and emulator
results remain recorded above; they were not repeated for this browser-only
follow-up. The restored Firebase app was then opened in a fresh tab: the new post
was visible, with zero diagnostic messages and no console errors. No new behavior correction was needed
after the live verification. The original historical provider difference remains
unreproduced.

The original historical differential remains unexplained. Any future reproduction
should use browser breakpoints or newly scoped instrumentation; this revision no
longer contains the temporary trace helper or its activation flag.


## Instrumentation cleanup

Removed the temporary helper and its dedicated tests, trace calls in providers,
cursors, list lifecycle, publication completion, transformation, route handling,
and refresh reducer, plus logging-only callback wrappers and list bookkeeping.
The flushSync navigation correction and functional regression tests are retained.
Local listener error reporting and safe cleanup remain unchanged.

Validation after removal: 44/44 targeted tests pass; Redequate, The Whisky Talks,
and demo builds pass. No temporary trace code remains in executable sources or
rebuilt core. Cleanup logs are `/private/tmp/discover-cleanup-tests.log`,
`/private/tmp/discover-cleanup-core-build.log`,
`/private/tmp/discover-cleanup-app-build.log`, and
`/private/tmp/discover-cleanup-demo-build.log`. No new posts were published for
this cleanup, and no commits or pushes were performed.
