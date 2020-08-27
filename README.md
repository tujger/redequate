# redequate

> Edeqa PWA React core

[![NPM](https://img.shields.io/npm/v/edeqa-pwa-react-core.svg)](https://www.npmjs.com/package/redequate) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save redequate
```

## Usage

Copy example app and make necessary changes.

https://github.com/tujger/edeqa-pwa-react-demo

## Troubleshooting

https://stackoverflow.com/questions/56021112/react-hooks-in-react-library-giving-invalid-hook-call-error


Below are the steps I followed :
1. In Your Library:

        cd node_modules/react && npm link && cd ../react-dom && npm link && cd .. && cd ..

2. In Your Application:

        npm link react && npm link react-dom

3. Stop your dev-server and do `npm start` again.


If `No Xcode or CLT version detected!` happens:

        sudo rm -rf $(xcode-select -print-path)
        sudo xcode-select --install


## Definitions

There is important to define two variables: `pages` and `menu`;

    const pages = {

        // generic cases

        about: {route: "/about", label: "About", icon: <AboutIcon/>, component: <About/>},

        chat: {route: "/chat/:id", label: "Chat", icon: <ChatsIcon/>, component: <Chat/>, pullToRefresh: false, roles: [Role.ADMIN, Role.USER]},

        chats: {route: "/chats", label: "Chats", icon: <ChatsIcon/>, component: <Chats/>, roles: [Role.ADMIN, Role.USER], daemon: true, adornment: (user) => <ChatsCounter/>},

        contacts: {route: "/contacts", label: "Contacts", icon: <ContactsIcon/>, component: <Contacts/>},

        editprofile: {route: "/edit/profile/*", label: "Edit profile", icon: <EditProfileIcon/>, component: <EditProfile uploadable={false} publicFields={publicFields}/>, roles: [Role.ADMIN, Role.USER]},

        home: {route: "/", label: "Home", icon: <HomeIcon/>, component: <Home/>},

        login: {route: "/login", label: "Login", icon: <LoginIcon/>, component: <Login signup={true} popup={false}/>, roles: [Role.LOGIN]},

        logout: {route: "/logout", label: "Logout", icon: <LogoutIcon/>, component: <Logout immediate={true}/>, roles: [Role.ADMIN, Role.USER, Role.USER_NOT_VERIFIED, Role.DISABLED]},

        main: {route: "/", label: "Home", icon: <HomeIcon/>, component: <Home/>},

        profile: {route: "/profile/*", label: "Profile", icon: <ProfileIcon/>, component: <Profile/>, roles: [Role.ADMIN, Role.USER, Role.USER_NOT_VERIFIED, Role.DISABLED]},

        restore: {route: "/user/restore", label: "Restore password", icon: <RestorePasswordIcon/>, component: <RestorePassword/>},

        search: {route: "/search", label: "Search", icon: <SearchIcon/>, component: <Search/>},

        signup: {route: "/signup", label: "Sign up", icon: <LoginIcon/>, component: <Signup signup={true}/>},

        signupFinish: {route: "/signup/:email", label: "Sign up", icon: <LoginIcon/>, component: <Signup signup={true}/>},

        user: {route: "/user/:id", label: "User", icon: <ProfileIcon/>, component: <Profile/>, roles: [Role.ADMIN, Role.USER]},

        // generic admin cases

        adduser: {route: "/admin/add", label: "Add user", icon: <AddUserIcon/>, component: <AddUser/>, roles: [Role.ADMIN]},

        adminservice: {route: "/admin/service", label: "Service", icon: <ServiceIcon/>, component: <Service/>, roles: [Role.ADMIN]},

        edituser: {route: "/edit/user/:id", label: "Edit profile", icon: <EditProfileIcon/>, component: <EditProfile uploadable={false} publicFields={publicFields}/>, roles: [Role.ADMIN]},

        users: {route: "/admin/users", label: "Users", icon: <UsersIcon/>, component: <AdminUsers invitation={false}/>, roles: [Role.ADMIN]},

        widgets: {route: "/widgets", label: "Widgets", icon: <WatchlistIcon/>, component: <Widgets/>, roles: [Role.ADMIN]},

        // example use cases

        onlyadmin: {route: "/admin", label: "Admin", icon: <OnlyAdminIcon/>, component: <SimplePage title={resources.onlyadmin.title} body={resources.onlyadmin.body}/>, roles: [Role.ADMIN]},

        allroles: {route: "/allroles", label: "All roles", icon: <AllRolesIcon/>, component: <SimplePage title={resources.allroles.title} body={resources.allroles.body}/>},

        needauth: {route: "/needauth", label: "Need auth", icon: <NeedAuthIcon/>, component: <SimplePage title={resources.needauth.title} body={resources.needauth.body}/>, roles: [Role.AUTH]},

        onlyuser: {route: "/onlyuser", label: "Only user", icon: <OnlyUserIcon/>, component: <SimplePage title={resources.onlyuser.title} body={resources.onlyuser.body}/>, roles: [Role.USER, Role.USER_NOT_VERIFIED]},

        // here project related pages

        // notfound must be always at the last position
        notfound: {route: "/:path", label: "Not found", icon: <NotFoundIcon/>, component: <NotFound/>},
    };

Page options are:

    route: String, // based on 'react-router-dom'
    label: String,
    icon: React.Component,
    component?: React.Component,
    onClick?: Function,
    pullToRefresh?: Boolean, // if 'false' then disables pull-to-refresh in mobile wrapper
    roles?: Array,
    adornment?: (userData) => React.Component, // will be added to menu item
    daemon?: Boolean, // if 'true' then component will be mandatory called with 'daemon' argument
    disabled?: Boolean, // set 'true' to temporarily disable item

Roles are:

    AUTH - need to be logged in to access this page,
    ADMIN - administrator has higher priority access,
    DISABLED - user is suspended, has access to profile but no ability to edit,
    LOGIN -
    USER - regular user,
    USER_NOT_VERIFIED - user that did not verify his e-mail yet

Menu can contain all or some of items from `pages`. First item in each section is applied as a main element in `top menu` and ignored in `responsive drawer`. Also, if first item is not shown then section will not be shown as well.

    export const menu = [[
        pages.main,
        pages.home,
    ], [
        pages.login,
        pages.login,
    ], [
        pages.profile,
        pages.profile,
        pages.logout,
    ], [
        pages.onlyadmin,
        pages.adminservice,
        pages.users,
        pages.games,
        pages.widgets,
    ], [
        pages.about,
        pages.contacts,
        pages.about,
    ]];

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


## License


MIT © [tujger](https://github.com/tujger)
