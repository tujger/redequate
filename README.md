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
npm run test:unit               # component and Auth unit tests
npm run "test:watch core"       # unit tests in watch mode
npm run test:integration        # starts and stops the local emulators
npm run test:integration:watch  # keeps emulators running while Vitest watches
```

No sibling repositories are required. Test infrastructure lives in
`src/__tests__`: one Vitest config selects ordinary `.test.js` files by default
and `.integration.test.js` files with `--mode integration`. Tests live in each
module's source directory: `src/__tests__`, `auth/src/__tests__` and
`_common/src/__tests__`. Auth unit tests exercise LocalTestAuth, AuthBase, selection
and Context; Auth and UserData integration tests use the Firebase emulators. The emulator runner owns the local
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
mixing browser compat with Node Auth exports breaks popup resolver initialization
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
        types
            type_name: timestamp
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
            type - indexed into _activity/types
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
import LocalTestAuth from "redequate/auth/local-test";
import {useAuth} from "redequate/auth";

const auth = new LocalTestAuth();

<Dispatcher auth={auth} {...props} />
```

LocalTestAuth is intended exclusively for testing, not production. It simulates
all current Auth operations using browser localStorage, without importing Firebase.
The previous `redequate/auth/memory` subpath has been removed.

`new LocalTestAuth({storageKey: "my-app:local-auth"})` selects a storage namespace;
the default is `redequate:auth:local-test`. Accounts and sessions survive reloads.
Instances using the same key share state, including auth-state notifications in
the same window and across tabs. Different keys isolate accounts and sessions.
Construction does not access storage. Unavailable storage, invalid stored data
and failed writes reject operations with an `auth/*` error code; invalid data
is never silently replaced. Removing the storage key resets the simulation.

Every async Auth operation waits a random integer delay of 0–2000 ms, including
failed operations. Delays greater than 100 ms are logged through `console.debug`
with the method name and duration. Internal calls do not add another delay;
`from()` remains synchronous. No password or token is logged.

Email addresses are trimmed and lowercased; passwords require six characters.
Registration signs in an initially unverified account. Passwords and fake session
tokens are stored in plain text. Use only disposable test credentials.
`sendEmailVerification()` immediately verifies the current account.
`sendPasswordResetEmail()` records a request for an existing account and does not
change its password. `sendSignInLinkToEmail()` records a pending email;
`checkSignInWithEmailLink()` checks for any pending request, without inspecting a
URL. `signInWithEmailLink(email)` consumes that request, creates an account if
needed and signs in with verified email. These operations send no real email.
The stored `mail` array records operation type, email, timestamp and optional URL.

Google and Facebook sign-in use stable fake accounts at
`google@local-test.example` and `facebook@local-test.example`. Provider names
accept `google`/`facebook`, `google.com`/`facebook.com`, or objects with `providerId`.
Provider options are accepted but have no effect. Credential sign-in accepts a
non-empty string as a simulated Google token, or an object with `provider` or
`providerId`; tokens are not validated. Redirect signs in and stores a result
without navigation; `resolveRedirectResult()` consumes that result once.
`resolveToken()` returns an opaque `local-test:` token, or null when signed out;
`forceRefresh` generates a replacement. These tokens cannot authenticate backend
requests. `signOut()` clears the session and pending redirect, preserving accounts.

`updateProfile({displayName, photoURL})` persists supported fields (strings or null).
Password changes require an active session. A resolved user's `updatePassword()`
also checks that the same account is still signed in. Auth-state subscriptions
emit their initial state and changed current-user snapshots; token refreshes and
mail records alone do not emit. Await the subscription to obtain its synchronous
unsubscribe function. Storage failures during observation go to `onError`, when
provided; setup failures reject the subscription Promise.

Firebase is also available explicitly as the default export of
`redequate/auth/firebase`. Each implementation exports a class constructed with
`new Auth(...args)`. Arguments are implementation-specific, for example
`new FirebaseAuth({firebase})`. An external package can expose the same
class: `<Dispatcher auth={new MyAuth(options)} {...props} />`. Dispatcher receives
the resulting object directly; it does not construct an explicitly supplied class.
Create the object outside render or with `useMemo` to keep its identity stable.
Built-in implementations extend `AuthBase`; inheritance is optional for external
modules, and Dispatcher does not require `instanceof`. There is no registry.
LocalTestAuth keeps significant operation implementations in individual default-export
modules and shared helpers in `auth/src/local-test/common.js`.

CommonJS uses `const LocalTestAuth = require("redequate/auth/local-test").default`
and `const auth = new LocalTestAuth(options)`.

Dispatcher selects the supplied object once per mount, or dynamically imports
LocalTestAuth and constructs `new LocalTestAuth()` when `auth` is omitted.
FirebaseAuth requires explicit construction with `{firebase}` and selection
through the `auth` prop. Null, arrays, classes without an instance and other non-object values are configuration errors. Selection errors use the existing initialization error UI.
To change implementations, remount Dispatcher. `useAuth()` returns the selected
object from the nearest Dispatcher; outside its provider it throws. Separate
Dispatcher providers hold separate values, and separate constructor calls create
separate objects. Reusing an existing object across applications deliberately
shares it.

The Auth module covers authentication only. Dispatcher, UserData and application
flows still use Firebase for profiles, roles, CRUD and other services. Supplying
LocalTestAuth does not make the entire application work offline without Firebase.

### Auth contract

`AuthBase`, exported from `redequate/auth`, supplies explicit `Not implemented`
defaults. Built-in implementations override supported operations. The current
runtime signatures are defined in `auth/src/AuthBase.js`. All operations below
return Promises except synchronous `from(json)`.

| Method | Result |
| --- | --- |
| `from(json)` | Parsed `{id, role, public, requestedTimestamp, loaded}` for `UserData.fromAuth()` |
| `onAuthStateChanged(callback, onError?)` | `Promise<unsubscribe>`; callback receives an auth user or null |
| `createUserWithEmailAndPassword(email, password)` | `Promise<{user}>` |
| `signInWithEmailAndPassword(email, password)` | `Promise<{user}>` |
| `signInWithPopup(provider, options?)` | `Promise<{user}>` |
| `signInWithRedirect(provider, options?)` | `Promise<void>` |
| `resolveRedirectResult()` | `Promise<{user} \| null>` |
| `signInWithCredential(credential)` | `Promise<{user}>` |
| `sendSignInLinkToEmail(email, options?)` | `Promise<void>` |
| `checkSignInWithEmailLink()` | `Promise<boolean>` |
| `signInWithEmailLink(email)` | `Promise<{user}>` |
| `sendEmailVerification(options?)` | `Promise<void>` |
| `sendPasswordResetEmail(email, options?)` | `Promise<void>` |
| `resolveCurrentUser()` | `Promise<auth user \| null>` |
| `updatePassword(password)` | `Promise<void>` |
| `updateProfile(fields)` | `Promise<void>` |
| `resolveToken(forceRefresh?)` | `Promise<string \| null>` |
| `signOut()` | `Promise<void>` |

An auth user is the authentication snapshot consumed by current components:
`uid`, `email`, `emailVerified`, `displayName`, `photoURL`, `providerData`,
`createdAt`, `lastLoginAt`, `toJSON()` and `updatePassword(password)`.
LocalTestAuth returns detached snapshots with no password or session token.
`from()` converts the JSON snapshot for the existing UserData; it does not create
or import UserData. Profile database persistence and roles remain outside Auth.

Session restoration uses the initial auth-state callback. Obtain the synchronous
unsubscribe function with
`const unsubscribe = await auth.onAuthStateChanged(callback, onError)`.
Constructors and `useAuth()` remain synchronous. Provider options may contain
`scopes` and `parameters`; credential objects may contain
`{provider, idToken?, accessToken?}`. Email options may contain
`{url, handleCodeInApp?}`. Implementations own their constructor configuration.

### Internal common layer

Shared code resides in `_common/src`; it has no public package subpath or
separate npm package. Public classes are re-exported through `redequate`.
`src/controllers/UserData.js` remains a compatibility re-export of the moved
implementation, so existing components and tests retain their imports.

UserData was moved without changing its behavior and still depends on Firebase,
including its existing persistence and current-user helpers. LocalTestAuth converts auth snapshots without importing
UserData: importing LocalTestAuth or the neutral Auth entry does not load UserData
or Firebase. An implementation importing UserData at runtime would need to
address that legacy dependency in a separate migration. Core application
imports still include Firebase SDK services.

Auth runtime source lives in `auth/src`; its build configuration remains in
`auth/build.mjs`.
`auth/build.mjs` supplies entry points, source matching and output naming to
Rollup; it has no runtime import or public export. Shared source lives in
`_common/src`. Both remain part of the same npm package, whose
published files are built into `core`. The example resolves the package through
its normal dependency and conditional exports, without an ESM-file alias.

The web ESM entry is `core/index.es.js`, with `.es.js` core chunks, preserving
Vite's existing CommonJS default-import behavior. Auth ESM entries and their
shared Context/AuthBase/Babel-helper chunks use `.mjs` for native Node imports.
Both formats share one Context within their build; default Auth remains lazy.
