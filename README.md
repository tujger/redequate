# redequate

> Former **Edeqa PWA React core**

[![NPM](https://img.shields.io/npm/v/redequate)](https://www.npmjs.com/package/redequate) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

Requires Node.js 24 or newer. Node.js 24 LTS is recommended; use `nvm use`
in this repository to select the version from `.nvmrc`.

```bash
npm install --save redequate
```

## Usage

Copy example app and make necessary changes.

https://github.com/tujger/edeqa-pwa-react-demo

Choose a CSS palette by passing a theme component to `Dispatcher`:

```jsx
import {Dispatcher, ThemeDayNight, ThemeSeason} from "redequate";

<Dispatcher theme={<ThemeSeason/>} {...props}/>;
// Or use <ThemeDayNight/> for approximate local sunrise and sunset.
```

Without `theme`, `Dispatcher` uses the base palette. `ThemeSeason` selects colors by the local month. `ThemeDayNight` uses approximate daylight hours for each season without requesting location access.

For a custom palette, `Theme` mounts the CSS when rendered and removes it on unmount. When building a theme inside redequate with its Rollup configuration, a regular CSS import provides the stylesheet text:

```jsx
import {Theme} from "redequate";
import styles from "./styles.css";

<Theme css={styles}/>;
```

For a Create React App consumer, place `theme.css` in `public/` and pass its URL instead. CRA's normal CSS import applies styles globally and cannot be removed with the theme:

```jsx
import {Dispatcher, Theme} from "redequate";

<Dispatcher theme={<Theme href={`${process.env.PUBLIC_URL}/theme.css`}/>} {...props}/>;
```

Both forms replace the mounted stylesheet when `theme` changes. The CSS can set palette variables with `:root { --theme-color-primary: #6750a4; }`.

## Migration from 1.2.17 to 2.0.20

These notes cover the current source tree, including MUI 9 changes. React 19 stabilization is still in progress.

- **Dependencies:** React and React DOM now require `^18.3.1 || ^19.0.0`; keep their versions aligned and use `createRoot` instead of `ReactDOM.render`. Update peers from [package.json](package.json), including MUI 9 and Emotion. Replace `react-datepicker-t` and `react-mentions-t` imports with upstream packages, and icon imports with `@mui/icons-material`.
- **Themes and styling:** `Dispatcher.theme` accepts `<ThemeSeason/>`, `<ThemeDayNight/>`, or `<Theme css={...}/>` / `<Theme href={...}/>` instead of a MUI theme object. Replace removed `createTheme`, JSS, and `classes` overrides with CSS variables and supported `className`/`style` props. Applications using MUI components need their own `ThemeProvider`. See [Usage](#usage).
- **Controls:** Review props and callbacks when replacing MUI controls. `Select` uses `options` and `onChange(event)`; `Tabs` uses `items` and `onChange(value)`; `TextField` uses `helper` and direct input props. Redequate `Button` requires explicit form submission. `DateTimePicker` still returns Moment values; clearing calls `onChange(null, null)`.
- **Mentions:** `MentionsInputComponent.onChange` receives `(event, nextValue, plainValue, mentions)`. Use `multiline`, `mentionsParams`, and `inputRef` instead of fork-specific props. Existing saved user/tag markup remains compatible.
- **Addresses:** Geoapify replaces the old geocoder. Set `meta/settings/geoapifyApiKey` in Firebase or through admin Settings. Without a key, autocomplete is unavailable. `PlacesTextField.onChange(event, value)` returns a string when typing and `{title, data}` when selecting a suggestion.
- **Imports and validation:** Import from `redequate` rather than internal paths. Run the standalone framework checks in [Tests](#tests); consumers separately validate themes, navigation, forms, dates, mentions, and addresses. See [Troubleshooting](#troubleshooting) for local linking and [DEVELOPMENT.md](DEVELOPMENT.md) for migration status.

## Tests

Use Node.js 24.12+ and Java 17+. Install framework dependencies with
`npm ci --legacy-peer-deps`. The first emulator run downloads the Database
Emulator JAR. Firebase login and production credentials are not required.

```sh
npm test                       # unit tests, then Auth/RTDB integration tests
npm run "test core"             # compatible name for the complete test gate
npm run test:unit               # component and package unit tests
npm run "test:watch core"       # unit tests in watch mode
npm run test:integration        # starts and stops the local emulators
npm run test:integration:watch  # keeps emulators running while Vitest watches
```

No sibling repositories are required. Test infrastructure lives in
`src/__tests__`: one Vitest config selects ordinary `.test.js` files by default
and `.integration.test.js` files with `--mode integration`. Tests live in each
module's source directory: `src/__tests__` and `packages/*/src/__tests__`.
Package build helpers are covered in `packages/__tests__`. Unit tests cover
Auth, Messaging and Storage contracts, provider selection, Contexts and local
providers; LocalStorage uses `fake-indexeddb`. Firebase Messaging and Storage
use mocked SDKs, without real message delivery or cloud uploads.
Auth and UserData integration tests use the Firebase emulators. The emulator runner owns the local
service settings and `demo-redequate-tests` project ID; it generates Firebase
configuration in its temporary log directory and copies `fixtures/database.rules.json`
there because Firebase CLI disallows rules outside that directory. Fixtures use
the CLI-provided `GCLOUD_PROJECT` to derive
`demo-redequate-tests-default-rtdb` and require a demo project plus local endpoints.
Restart the integration runner after changing fixture rules to refresh that copy.
Auth listens on 127.0.0.1:9099 and Database on 127.0.0.1:9000. If these ports
are occupied, stop that local emulator session first; tests do not silently
fall back to a cloud Firebase project.

Fixtures reset emulated Auth accounts and Database data between integration
tests. Auth action codes stay in the emulator; no invitation or verification
email is sent. These checks do not validate Google/Facebook login, delivery of
real emails, Storage, Functions or FCM. Database rules are framework test fixtures:
public user records require authentication to read and allow fixture writes;
private records require their owner; roles are readable; other paths are closed.
They are not production policies or verification of any application's security rules.

The runner removes inherited credential environment variables and stores
debug logs in the temporary directory printed at startup. It does not modify
cloud Firebase projects or production data.

Vitest uses jsdom, JSX in `.js`, CSS Modules and React `act`/`createRoot`.
Firebase integration config explicitly resolves browser Auth internals because
mixing browser and Node Auth exports breaks popup resolver initialization
in jsdom. This resolution is test-only; application Vite configs are unchanged.

Consumer applications own their tests, Firebase rules and local linking commands.
The generic `link-redequate-react.sh` helper accepts a consumer directory; it has
no knowledge of specific applications. Consumer validation is separate from the
framework's standalone test gate.

Build verification order:

```sh
npm run "build core"
npm --prefix example ci --legacy-peer-deps
npm --prefix example run build
```

See `example/README.md` for the Vite example and its GitHub Pages base path.

## Troubleshooting

https://stackoverflow.com/questions/56021112/react-hooks-in-react-library-giving-invalid-hook-call-error


When developing a consumer against this local package, shared dependencies must resolve to the same physical packages. After installing dependencies in both repositories, call the generic helper with the consumer directory from the framework root:

```sh
sh ./link-redequate-react.sh /absolute/path/to/consumer
npm run "start core"
```

The helper connects the consumer's `react`, `react-dom`, `i18next` and `react-i18next` to the copies installed in Redequate, requiring matching versions and checking resolution paths. The consumer owns its installation, linking and dev-server commands. Repeat linking after a consumer-side `npm install` and restart any running development server. Redequate has no consumer-specific `relink` script or default target.

All projects using this local setup must use matching React and React DOM versions in Redequate and the consumer. The current development projects use `19.3.0`; Redequate's peer range also permits React `18.3.1`.



If `No Xcode or CLT version detected!` happens:

        sudo rm -rf $(xcode-select -print-path)
        sudo xcode-select --install



    npm config set legacy-peer-deps true

## Definitions

There is important to define two variables: `pages` and `menu`;

    const pages = {

        // generic cases

        about: {route: "/about", label: t("Definitions.About"), icon: <AboutIcon/>, component: <About/>},

        alerts: {route: "/alerts", label: t("Definitions.Alerts"), icon: <AlertsIcon/>, component: <Alerts fetchAlertContent={fetchAlertContent}/>, roles: [Role.ADMIN, Role.USER], daemon: true, adornment: (user) => <AlertsCounter/>},

        chat: {route: "/chat/:id", label: t("Definitions.Chat"), icon: <ChatsIcon/>, component: <Chat/>, pullToRefresh: false, roles: [Role.ADMIN, Role.USER]},

        chats: {route: "/chats", label: t("Definitions.Chats"), icon: <ChatsIcon/>, component: <Chats/>, roles: [Role.ADMIN, Role.USER], daemon: true, adornment: (user) => <ChatsCounter/>},

        contacts: {route: "/contacts", label: t("Definitions.Contacts"), icon: <ContactsIcon/>, component: <Contacts/>, roles: [Role.ADMIN, Role.USER]},

        editprofile: {route: "/edit/profile/*", label: t("Definitions.Edit profile"), icon: <EditProfileIcon/>, component: <EditProfile uploadable={true}/>, roles: [Role.ADMIN, Role.USER]},

        home: {route: "/", label: t("Definitions.Home","Home"), icon: <HomeIcon/>, component: <Home/>},

        login: {route: "/login", label: t("Definitions.Login"), title: t("Definitions.Login"), icon: <LoginIcon/>, component: <Login signup={true} popup={false}/>, roles: [Role.LOGIN]},

        logout: {route: "/logout", label: t("Definitions.Logout"), icon: <LogoutIcon/>, component: <Logout immediate={true}/>, roles: [Role.ADMIN, Role.USER, Role.USER_NOT_VERIFIED, Role.DISABLED]},

        main: {route: "/", label: t("Definitions.Home","Home"), icon: <HomeIcon/>, component: <Home/>},

        newpost: {route: "/new/post", label: t("Definitions.New post"), icon: <PostIcon/>, component: <NewPost/>, roles: [Role.ADMIN, Role.USER]},

        newtag: {route: "/new/tag", label: t("Definitions.Add tag"), icon: <GameIcon/>, component: <EditTag/>, roles: [Role.ADMIN, Role.USER]},

        post: {route: "/post/:id", label: t("Definitions.Post"), icon: <PostIcon/>, component: <Post/>},

        profile: {route: "/profile/*", label: t("Definitions.Profile"), icon: <ProfileIcon/>, component: <Profile/>, roles: [Role.ADMIN, Role.USER, Role.DISABLED]},

        reply: {route: "/post/:id/:comment/:reply", label: t("Definitions.Post"), icon: <PostIcon/>, component: <Post/>},

        restore: {route: "/user/restore", label: t("Definitions.Restore password"), icon: <RestorePasswordIcon/>, component: <RestorePassword/>},

        search: {route: "/search", label: t("Definitions.Search"), icon: <SearchIcon/>, component: <Search/>},

        signup: {route: "/signup", label: t("Definitions.Sign up"), icon: <LoginIcon/>, component: <Signup signup={true} additional={<Agreement/>}/>},

        signupFinish: {route: "/signup/:email", label: t("Definitions.Sign up"), icon: <LoginIcon/>, component: <Signup signup={true}/>},

        tag: {route: "/tag/:id", label: t("Definitions.Group","Group"), icon: <GameIcon/>, component: <Tag/>},

        user: {route: "/user/:id", label: t("Definitions.Profile"), icon: <ProfileIcon/>, component: <Profile/>, roles: [Role.ADMIN, Role.USER]},

        // generic admin cases

        activity: {route: "/admin/activity", label: "Activity", icon: <ErrorsIcon/>, component: <Activity/>, roles: [Role.ADMIN]},

        admin: {route: "/admin", label: "Admin", icon: <OnlyAdminIcon/>, component: <Admin fetchMenu={pages => menu(pages)}/>, roles: [Role.ADMIN]},

        adduser: {route: "/admin/add", label: "Add user", icon: <AddUserIcon/>, component: <AddUser/>, roles: [Role.ADMIN]},

        settings: {route: "/admin/settings", label: "Settings", icon: <ServiceIcon/>, component: <Settings uploadable={true}/>, roles: [Role.ADMIN]},

        audit: {route: "/admin/audit", label: "Audit", icon: <ErrorsIcon/>, component: <Audit/>, roles: [Role.ADMIN]},

        edittag: {route: "/edit/tag/:id", label: "Edit group", icon: <GameIcon/>, component: <EditTag/>, roles: [Role.ADMIN, Role.USER]},

        edituser: {route: "/edit/user/:id", label: "Edit profile", icon: <EditProfileIcon/>, component: <EditProfile uploadable={true}/>, roles: [Role.ADMIN]},

        errors: {route: "/admin/errors", label: "Errors", icon: <ErrorsIcon/>, component: <Errors/>, roles: [Role.ADMIN]},

        tags: {route: "/admin/tags", label: "Tags", icon: <TagIcon/>, component: <Tags/>, roles: [Role.ADMIN]},

        users: {route: "/admin/users", label: "Users", icon: <UsersIcon/>, component: <Users invitation={false}/>, roles: [Role.ADMIN]},

        widgets: {route: "/widgets", label: "Widgets", icon: <WidgetsIcon/>, component: <Widgets/>, roles: [Role.ADMIN]},

        // example use cases

        allroles: {route: "/allroles", label: "All roles", icon: <AllRolesIcon/>, component: <SimplePage title={resources.allroles.title} body={resources.allroles.body}/>},

        needauth: {route: "/needauth", label: "Need auth", icon: <NeedAuthIcon/>, component: <SimplePage title={resources.needauth.title} body={resources.needauth.body}/>, roles: [Role.AUTH]},

        onlyadmin: {route: "/admin", label: "Admin", icon: <OnlyAdminIcon/>, component: <SimplePage title={resources.onlyadmin.title} body={resources.onlyadmin.body}/>, roles: [Role.ADMIN]},

        onlyuser: {route: "/onlyuser", label: "Only user", icon: <OnlyUserIcon/>, component: <SimplePage title={resources.onlyuser.title} body={resources.onlyuser.body}/>, roles: [Role.USER, Role.USER_NOT_VERIFIED, Role.DISABLED]},

        // here are project related pages

        // notfound must be always at the last position
        notfound: {route: "/:path", label: t("Definitions.Not found"), icon: <NotFoundIcon/>, component: <NotFound/>},
    };

Page common options are:

    adornment?: (UserData) => React.Component, // will be added to menu item
    component?: React.Component,
    daemon?: Boolean, // if 'true' then component will be mandatory called with 'daemon' argument
    disabled?: Boolean, // set 'true' to temporarily disable item
    icon: React.Component,
    label: String,
    onClick?: Function,
    pullToRefresh?: Boolean, // if 'false' then disables pull-to-refresh in mobile wrapper when this page is shown
    roles?: Array,
    route: String, // based on 'react-router-dom'
    title?: String, // uses 'label' if not defined

Roles are:

    AUTH - page can be shown in menus to all users but user must be logged in to access the page,
    ADMIN - administrator has higher priority access,
    DISABLED - user is suspended, has access to profile but no ability to edit or do any actions,
    LOGIN - user not logged in; show page only to that users,
    USER - regular user,
    USER_NOT_VERIFIED - user that did not verify his e-mail yet

Menu can contain all or some of the items from `pages`. First item in each section is applied as a main element in `top menu` and ignored in `responsive drawer`. Also, if first item is not shown then section will not be shown as well.

    export const menu = [[
        pages.main,
        pages.home,
        pages.alerts,
        pages.chats,
    ], [
        pages.login,
        pages.login,
    ], [
        pages.profile,
        pages.profile,
        pages.logout,
    ], [
        pages.admin,
        pages.settings,
        pages.users,
        pages.audit,
        pages.widgets,
    ], [
        pages.about,
        pages.contacts,
        pages.about,
    ]];

## Simple pages



## Set up functions

Set up credentials for `sendMail`:

    firebase functions:config:set gmail.email="myusername@gmail.com" gmail.password="secretpassword"

Getting the password:

* go to gmail.com
* click your avatar
* click "Manage your Google Account"
* go to "Security"
* in section "Signing in to Google" click "App passwords"
* (switch on "2-Step verification" if necessary)
* click "Select App", type some alias
* click "Generate" and then copy password provided, use it for `secretpassword`

This password will be allowed only for the functions.

## Final deployment

Add .env.production:

    REACT_APP_VERSION=$npm_package_version
    GENERATE_SOURCEMAP=false
    INLINE_RUNTIME_CHUNK=false
    IMAGE_INLINE_SIZE_LIMIT=1024

# Components

## Mentions


## MentionsInputComponent

## NewPostComponent

Props:

    UploadProps: UploadComponent#options

## PostComponent

Props:

    allowedExtras?: ["like"]
    className?
    collapsible?: true
    disableClick?: false
    disableButtons?: false
    label?: string - if defined then shows only skeleton with label
    mentions?: [Mentions#mentionUsers]
    onChange?: postData => {}
    onDelete?: postData => {}
    postData: PostData
    showRepliesCounter?: true
    type?: "posts"
    skeleton?: false - if true then shows only skeleton as a progress
    UploadProps: UploadComponent#props
    userData: UserData

## UploadComponent

Props:

    button?
    camera?: true
    facingMode?: "user"
    limits?:
        height?: 1000
        size?: 100000
        quality?: 75
        width?: 1000
    multi?: true - if true then anyway limited to 10 files
    onsuccess: ({uppy, file, snapshot}) => {}
    onerror?: error => {}

## Database structure

    _activity
        activity_type_id
            activity_type_id - service key stored in the value
            type - original activity type (string)
            value - last indexed timestamp
    _chats
        uid/chat_id
            private? - opposite uid
            timestamp - last update
    _counters
        id/counter: number
    _tag
        tag_id
            post_id: uid
    activity
        activity_id
            details - object with details
            timestamp
            type - indexed as a value in _activity records
            uid
    alerts
        uid/alert_id
    chats
        chat_id
            !meta
                members
                    member_id: last visit timestamp
                timestamp: last change timestamp
            message_id
                created
                text
                uid
    errors
        error_id
            error - text
            timestamp
            uid
    extra
        extra_id
            id
            id_uid
            timestamp
            type - one of ["like", "dislike"]
            uid
            uid_id
    meta
        blockedNames: String
        maintenance
            message
            person: uid
            timestamp
        settings
            dynamicLinksUrlPrefix
            joinUsCancel
            joinUsConfirm
            joinUsScroll
            joinUsText
            joinUsTimeout
            joinUsTitle
            oneTapCliendId
            postsRepliesInside: Boolean
        support: uid
    mutual
        type/item_id
            id - mutual object id
            id_uid - mixed key
            timestamp
            type
            uid - subject id
            uid_id - mixed key
    mutualstamps
        _/uid - all items for uid
        _my/uid - all posts of uid
        _my_type/uid - all posts of uid in type
        _re/uid - all replies of uid
        _re_type/uid - all replies of uid in type
        type/uid - all items for uid in type
            post_id/author_uid
    posts
        post_id
            created
            edit?
                edit_id
                    timestamp
                    uid
            images
            root?
            text
            to: 0 or parent_id
            uid
    roles
        uid/role
    tag
        tag_id
            _sort_name? - also 'hidden=true' if not present
            description?
            hidden?: Boolean
            id
            image?
            label
            timestamp
            uid? - owner
    users_private
        uid/device_id
            agreeement?: Boolean
            browserName
            deviceType
            locale?
            notification?
            osName
            osVersion
    users_public
        uid
            _sort_name
            created: Timestamp
            email
            emailVerified: Boolean
            image?
            lastLogin: Timestamp
            name
            provider
            updated: Timestamp
            visit: Timestamp
            ...other options


## License


MIT © [tujger](https://github.com/tujger)

## Auth modules

```jsx
import Dispatcher, {UserData} from "redequate";
import LocalAuth from "redequate/auth/local";
import {useAuth} from "redequate/auth";

const auth = new LocalAuth({database, UserData});

<Dispatcher auth={auth} {...props} />
```

LocalAuth is intended exclusively for testing, not production. It simulates
all current Auth operations using browser IndexedDB, without importing Firebase.
The previous `redequate/auth/memory` subpath has been removed.

`new LocalAuth({storageId: "my-app"})` selects an IndexedDB database;
the default is `redequate:local`. Accounts and sessions survive reloads.
Instances using the same ID share state, including auth-state notifications in
the same window and across tabs. Different IDs isolate accounts and sessions.
Construction does not access storage. Unavailable storage, invalid stored data
and failed writes reject operations with an `auth/*` error code; invalid data
is never silently replaced. Auth records live in the reserved `$auth` store, with
categories distinguished by type and key. Account keys also identify UserData and
profile records. LocalStorage uses `$storage`, LocalMessaging uses `$messaging`;
providers with the same storageId share one database. Old stores and databases
are untouched and are not automatically migrated.
Pass the application's database in the constructor to load the signed-in user's
`users_public`, `roles`, and `users_private` records. FirebaseAuth accepts the same
`database` option alongside `firebase`. Registration and profile updates require
a database, as does email verification. These checks run in AuthBase before
provider effects. Registration saves the initial public profile before returning;
passwords and sessions remain with the authentication provider. Dispatcher passes
its resolved database only when constructing the default LocalAuth; explicitly
supplied instances must receive their database in the constructor.

LocalAuth provider operations wait a random integer delay of 0–2000 ms.
Shared argument validation rejects malformed inputs before provider access or
simulated delays. Provider-level failures still follow their operation's delay.
Delays greater than 100 ms are logged through `console.debug` with the method name
and duration. Internal calls do not add another delay;
Internal JSON conversion is synchronous. No password or token is logged.
Local sign-in saves a new profile, installs the session, then obtains its result
through `resolveCurrentUser({skipDelay: true})`. Same-window sign-in notifications
are emitted after the profile loads. On failure, the previous local state is
restored only if that pending session is still unchanged; a later logout or login
is preserved. Transactions compare revisions to reject conflicting writes.
Cross-tab notifications use BroadcastChannel messages containing only namespace
and revision; sign-in publishes after profile loading. Auth and the injected
profile database do not share an atomic transaction.

Email addresses are trimmed and lowercased; passwords require six characters.
Registration signs in an initially unverified account. Passwords and fake session
tokens are stored in plain text. Use only disposable test credentials.
`sendEmailVerification()` immediately verifies the current account.
`sendPasswordResetEmail()` records a request for an existing account and does not
change its password. `sendSignInLinkToEmail()` records a pending email;
`checkSignInWithEmailLink()` checks for any pending request, without inspecting a
URL. `signInWithEmailLink(email)` consumes that request, creates an account if
needed and signs in with verified email. These operations send no real email.
The mail records in `$auth` contain operation type, email, creation time and optional
`url` and `handleCodeInApp` settings.

Google and Facebook sign-in use stable fake accounts at
`google@local.example` and `facebook@local.example`. Provider names
accept `google`/`facebook`, `google.com`/`facebook.com`, or objects with `providerId`.
Provider options are accepted but have no effect. Credential sign-in accepts a
non-empty string as a simulated Google token, or an object with `provider` or
`providerId`; tokens are not validated. Redirect signs in and stores a result
without navigation; `resolveRedirectResult()` consumes that result once.
`signOut()` clears the session and pending redirect, preserving accounts.

`updateProfile({public, role, private})` saves supplied fields for the current user
through one database batch: `users_public/<uid>`, `roles/<uid>` and
`users_private/<uid>`. Nested updates preserve other fields; undefined values are
skipped and null deletes the addressed value. For example,
`auth.updateProfile({public: {name: "Alice", image: "photo.png"}, private: {device: {locale: "en"}}})`.
The default null role and empty private section need no registration writes.
Database rules control permission to change roles. Profile updates do not write
Firebase Authentication displayName/photoURL or the local account's profile fields.
Password changes require an active session and use `auth.updatePassword()`.
Auth-state subscriptions
emit their initial state and changed current-user snapshots; mail records alone do not emit. Await the subscription to obtain its synchronous
unsubscribe function. Storage failures during observation go to `onError`, when
provided; setup failures reject the subscription Promise.

Firebase is also available explicitly as the default export of
`redequate/auth/firebase`. Each implementation exports a class constructed with
`new Auth(...args)`. Arguments are implementation-specific, for example
`new FirebaseAuth({firebase, database, UserData})`. An external package can expose the same
class: `<Dispatcher auth={new MyAuth(options)} {...props} />`. Dispatcher receives
the resulting object directly; it does not construct an explicitly supplied class.
Create the object outside render or with `useMemo` to keep its identity stable.
Built-in implementations extend `AuthBase` and call `super(options)` for shared
`database` and `UserData` configuration. Each implementation calls the matching
supermethod before its provider logic, for example
`super.signInWithEmailAndPassword(email, password)`. Validation is synchronous:
invalid arguments throw immediately, while valid arguments let the implementation
continue. No protected operation-dispatch methods are needed. Shared model
construction, profile saving and subscription utilities remain reusable.
External structural instances remain supported without inheritance or an
`instanceof` requirement; there is no registry.
LocalAuth keeps significant operation implementations in individual default-export
modules and shared helpers in `packages/auth/src/local/common.js`.

CommonJS uses `const LocalAuth = require("redequate/auth/local").default`
and `const auth = new LocalAuth(options)`.

Dispatcher selects the supplied object once per mount, or dynamically imports
LocalAuth and constructs `new LocalAuth({database})` when `auth` is omitted.
Both implementations accept an optional `UserData` constructor, defaulting to the
neutral model from `redequate/common`. Dispatcher does not choose or replace this
model. Pass the web `UserData` exported by `redequate` to the Auth constructor when
its persistence methods are needed. An explicitly supplied Auth instance keeps
all of its constructor configuration; Dispatcher does not inject dependencies
into it.
FirebaseAuth requires explicit construction with `{firebase}` and selection
through the `auth` prop. Null, arrays, classes without an instance and other non-object values are configuration errors. Selection errors use the existing initialization error UI.
To change implementations, remount Dispatcher. `useAuth()` returns the selected
object from the nearest Dispatcher; outside its provider it throws. Separate
Dispatcher providers hold separate values, and separate constructor calls create
separate objects. Reusing an existing object across applications deliberately
shares it.

The Auth module covers authentication only. Dispatcher, UserData and application
flows still use Firebase for profiles, roles, CRUD and other services. Supplying
LocalAuth does not make the entire application work offline without Firebase.

Local providers now use `local` module paths and storage namespaces, with
`Local` class names. Previous module paths have no compatibility aliases.
Existing local data remains under its previous keys and is not automatically
migrated or deleted; the new default keys start with fresh local state.

### Auth contract

`AuthBase`, exported from `redequate/auth`, supplies shared profile persistence
and model construction. Its operation supermethods check arguments; implementations
then load profiles and deliver auth-state updates using common utilities.
`AuthImplementation` in the same TypeScript file describes the async provider
contract; validation-only supermethods return void. Operations with no shared
validation or implementation retain `Not implemented` defaults. Email
normalization and password policies remain provider-specific; Firebase SDK errors
pass through unchanged. Argument shape failures use `auth/invalid-argument`.
The current
runtime signatures are defined in `packages/auth/src/AuthBase.ts`. All operations below
return Promises.

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

Authentication results are detached `UserData` objects with `id`, `email`, `name`,
`image`, `verified`, `role`, `public`, `private` and `toJSON()`. SDK credentials,
provider user methods, passwords and tokens are not included. Each adapter
forms the UserData JSON object (`id`, `role`, `public`, `private`, `requested`,
`loaded`) and passes it directly to `new UserData().fromJSON({...})`. Auth has no public parser, and UserData has no
`fromAuth()` method. Provider failures pass through unchanged, including their error codes.
Built-in validation failures use `Error`. Missing redirect results return null;
session restoration returns an anonymous UserData when signed out.
Password changes use Auth methods. Token retrieval remains in the Firebase
backend integration. AuthBase shares profile saving and loading through database;
application code continues to own profile forms and business role decisions.

Session restoration uses the initial auth-state callback. Obtain the synchronous
unsubscribe function with
`const unsubscribe = await auth.onAuthStateChanged(callback, onError)`.
Constructors and `useAuth()` remain synchronous. Provider options may contain
`scopes` and `parameters`; credential objects may contain
`{provider, idToken?, accessToken?}`. Email options may contain
`{url, handleCodeInApp?}`. Firebase forwards these settings to its SDK; Local records
them in its simulated mail. Email-link requests default to the current origin's
`/signup/<email>` URL and `handleCodeInApp: true`. Explicit values override defaults;
undefined values retain them. SDK validation still applies to supplied values.
Implementations own their constructor configuration.

### Provider storage identifiers

Providers that previously accepted a storage key now accept `storageId`, without
an alias for the old option. It defaults to the existing `LOCAL_DATABASE_NAME`
(`redequate:local`) only when omitted or undefined. Explicit IDs must be non-empty
strings and are used as supplied. LocalDatabase opens that physical database name;
LocalAuth, LocalStorage and LocalMessaging share it when configured with the same ID.
Store names beginning with `$` belong to providers, including future providers;
application collection reads and schemas cannot target them. Each provider owns its local/stores.json and supplies it when accessing storage.
Opening and schema upgrades support any initialization order. Only the provider's
own stores are created; opening without a schema creates none. Database keeps its
existing stores.json format and does not initialize the service stores.

LocalMessaging persists `{key: "token", token}` in `$messaging`, preserving atomic
subscription creation and checking the saved subscription before delivering messages.
Its message envelope uses storageId. FirebaseMessaging uses the localStorage key
`<storageId>:notification-token`. These provider keys use storageId as a prefix;
other framework and SDK storage keys are unchanged. Old localStorage tokens are
neither read as a fallback nor migrated or deleted. Existing application data in
previous physical database names is also left untouched.

### Local backend

`LocalBackend` from `redequate/backend/local` accepts `{storageId}`, defaulting to
`redequate:local`. It writes prepared record objects through
`request("database.create", path, value)`, returning the saved key or rejecting.
It accepts prepared objects, requires prepared stores and publishes collection changes after commit.

LocalBackend also accepts `request("database.update", path, changes, options?)` on
prepared stores. The default `patch` mode accepts relative child paths; an empty
path accepts root-relative objects or Maps of Local paths, atomically across stores.
`{mode: "read"}` with a null value returns `{value, etag}`. `{mode: "replace", etag}`
conditionally saves a prepared value and returns `{committed: true, value}` or the
fresh `{committed: false, value, etag}` snapshot. Callbacks stay with the caller.
Committed writes notify observers; reads, conflicts and failures do not. LocalDatabase.update delegates to this
handler: object changes are merged in Database, callbacks prepare full replacements,
and ETag conflicts rerun preparation up to 25 times. Object changes use Firebase
semantics: retain unspecified children and replace supplied child objects entirely. Batch values
are sent as complete replacements in one root Map. Like create, update requires an
explicit backend and separately prepared stores; it does not open IndexedDB or emit
notifications itself.

Local and Firebase prepare paths and batch payloads in their own `update` methods,
then explicitly call `super.update`. Their single outer `this.run` boundary handles
errors with the original arguments. The superclass uses `common/methods/update`: a single-path object update reads
its snapshot, applies shallow or relative-path changes in Database, then sends the
whole value for ETag-conditional replacement. Callbacks also prepare full replacements.
Both require the supplied backend; Firebase update has no client fallback and now
requires read as well as write permission for object updates. Batch payloads remain
one atomic map of full replacements at their individual addresses.

Pass a backend explicitly when constructing LocalDatabase:

```js
const backend = new LocalBackend({storageId});
const database = new LocalDatabase({storageId, backend});
```

LocalDatabase.create generates the final key when needed, evaluates a synchronous
callback with that key, validates the result, and sends the prepared path/object
to its supplied backend. There is no backend fallback. The create method retains its error boundary but performs no schema preparation,
collection checks, storage access or listener notification. Backend stores must be
prepared separately. Dispatcher resolves backend before constructing its default database.

All new automatic Local keys are 20-character, time-sortable IDs from firebase-key.
They sort by generation time, with monotonic generation within one generator even
in the same millisecond or after a clock rollback. They do not describe server commit
time or establish global order between devices with different clocks. Existing and
explicit keys are unchanged; mixed historical keys do not gain chronological order.
Local excludes native and schema-defined service keys when returning object records. Failed saves leave no record; generated
logical IDs are not reserved or reused. Direct backend requests without a key use the
same string-key generator. No data migration is performed.

### Local IndexedDB records

Local objects store fields directly, with no `_record`, `_encoded`, `_local` or
restoration metadata. Reads exclude `_id` and fields of unique indexes, even when
explicitly supplied in the object. Other indexed data, such as post `uid` and `to`,
remain ordinary returned fields. For stores without unique indexes, fields selected
in the address or as the collection key are excluded. Empty branches left by nested
service keys are pruned. Indexed path parents must be objects.
Strings, numbers, booleans and arrays use `{_value: value}` as their only payload,
without an extra type marker. `_value` is reserved at the record root; old service
fields `_record` and `_encoded` are also rejected there. Nested data may use these
names. Old wrappers reject with `VersionError`; they are not migrated or deleted.
Only indexes declared in stores.json or constructor stores are created; searches require
an appropriate index. Nested values stay inside their parent record. A store without
indexes (such as meta) holds one small document and supports field access rather than
record searches. The previous service envelope and generated identity index are
removed, along with their codecs and compatibility logic. No migration or automatic
data deletion is provided; use a clean local database for the new format.

### Independent common and server archive

Functions can install the private `redequate-server` archive under the `redequate` dependency
name to import `redequate/common`, `redequate/backend/common`,
`redequate/backend/common-server` and `redequate/backend/firebase-server`
without frontend dependencies. Both ESM and
CommonJS are supported on Node.js 22+. See [server packaging](packages/server/README.md)
for build and delivery instructions.

### Internal common layer

Shared code resides in `packages/common`. Its `redequate/common` entry exports
the neutral UserData model, role helpers and constants. The web controller in
`src/controllers/UserData.js` extends that model with persistence and cache methods.
Auth adapters construct the neutral model directly from normalized JSON.

The `auth`, `backend`, `database`, `messaging` and `storage` modules live under
`packages/`, including their existing tests and build configuration. Web entry
points build into `core`; the `*-server` backend entries are available only in
the server archive and never participate in the main package or frontend chunks.

Auth runtime source lives in `packages/auth/src`; its build configuration remains in
`packages/auth/build.mjs`.
`packages/auth/build.mjs` supplies entry points, source matching and output naming to
Rollup; it has no runtime import or public export. Shared source lives in
`packages/common`. Both remain part of the same npm package, whose
published files are built into `core`. The example resolves the package through
its normal dependency and conditional exports, without an ESM-file alias.

The web ESM entry is `core/index.es.js`, with `.es.js` core chunks, preserving
Vite's existing CommonJS default-import behavior. Auth ESM entries and their
shared Context/AuthBase/Babel-helper chunks use `.mjs` for native Node imports.
Both formats share one Context within their build; default Auth remains lazy.

### Cursor composition

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
