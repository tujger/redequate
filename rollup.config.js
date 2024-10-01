import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import filesize from "rollup-plugin-filesize";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import postcss from "rollup-plugin-postcss";
import pkg from "./package.json" assert {type: "json"};
import babel from 'rollup-plugin-babel'
import svgr from '@svgr/rollup'
import json from '@rollup/plugin-json'
import del from 'rollup-plugin-delete'

const plugins = [
    del({targets: ['core/*']}),
    peerDepsExternal(),
    resolve({
        preferBuiltins: true
    }),
    babel(),
    commonjs(),
    postcss({
        // plugins: [autoprefixer()],
        sourceMap: true,
        // extract: true,
        minimize: true,
        modules: true
    }),
    svgr(),
    typescript({tsconfig: "./tsconfig.json", declaration: true, "declarationDir": "core"}),
    json(),
    terser(),
    filesize(),
]

export default [
    {
        input: [
            "src/index.ts",
            "src/alerts.ts",
            "src/chat.ts",
            "src/components.ts",
            "src/controllers.ts",
            "src/layouts.ts",
            "src/pages.ts",
            "src/tags.ts",
        ],
        output: [
            {
                dir: 'core',
                exports: 'named',
                format: 'esm',
                preserveModules: true,
                preserveModulesRoot: "src",
                sourcemap: true,
            },
        ],
        context: "window",
        external: [
            ...Object.keys(pkg.peerDependencies),
            'react', 'react-dom', 'react-datepicker-t', 'react-smart-gallery', 'react-image-lightbox', 'react-image-lightbox', 'react-image-lightbox/style.css', 'react-datepicker-t/dist/react-datepicker.css'
        ],
        plugins,
    },
];
// // =====================
//
//
//
//
// import babel from 'rollup-plugin-babel'
// import commonjs from 'rollup-plugin-commonjs'
// import external from 'rollup-plugin-peer-deps-external'
// import postcss from 'rollup-plugin-postcss'
// import resolve from 'rollup-plugin-node-resolve'
// import url from 'rollup-plugin-url'
// import svgr from '@svgr/rollup'
// import del from 'rollup-plugin-delete'
// import json from '@rollup/plugin-json'
//
// import pkg from './package.json'  assert {type: "json"}
//
// export default [
//     {
//         input: 'src/index.js',
//         external: ['react', 'react-dom', 'react-datepicker-t', 'react-smart-gallery', 'react-image-lightbox', 'react-image-lightbox', 'react-image-lightbox/style.css', 'react-datepicker-t/dist/react-datepicker.css'],
//         output: [
//             {
//                 file: pkg.main,
//                 format: 'cjs',
//                 inlineDynamicImports: true,
//                 sourcemap: true,
//             }/*,
//         {
//             file: pkg.module,
//             format: 'es',
//             sourcemap: true
//         }*/
//         ],
//         plugins: [
//             del({targets: ['core/*']}),
//             external(),
//             postcss({
//                 modules: true,
//             }),
//             url(),
//             resolve(),
//             commonjs(),
//         ]
//     },
//     {
//         // input: {
//         //     index: 'src/index.js',
//         //     Dispatcher: 'src/Dispatcher.js',
//         //
//         //     // controllers
//         //     DateFormat: 'src/controllers/DateFormat.js',
//         //     FirebasePagination: 'src/controllers/FirebasePagination.js',
//         //     General: 'src/controllers/General.js',
//         //     lazyListComponentReducer: 'src/components/LazyListComponent/lazyListComponentReducer.js',
//         //     mentionTypes: 'src/controllers/mentionTypes.js',
//         //     notifySnackbar: 'src/controllers/notifySnackbar.js',
//         //     postItemTransform: 'src/components/PostComponent/postItemTransform.js',
//         //     PostData: 'src/components/PostComponent/PostData.js',
//         //     UserData: 'src/controllers/UserData.js',
//         //     WrapperControl: 'src/controllers/WrapperControl.js',
//         //     Theme: 'src/controllers/Theme.js',
//         //     uploadComponentControls: 'src/components/UploadComponent/uploadComponentControls.js',
//         //     useCurrentUserData: 'src/controllers/useCurrentUserData.js',
//         //
//         //     // components
//         //     AvatarView: 'src/components/AvatarView.js',
//         //     ButtonAddEvent: 'src/components/ButtonAddEvent.js',
//         //     ConfirmComponent: 'src/components/ConfirmComponent.js',
//         //     DateTimePicker: 'src/components/DateTimePicker/index.js',
//         //     HeaderComponent: 'src/components/HeaderComponent.js',
//         //     ItemPlaceholderComponent: 'src/components/ItemPlaceholderComponent.js',
//         //     JoinUsComponent: 'src/components/JoinUsComponent.js',
//         //     LazyListComponent: 'src/components/LazyListComponent/LazyListComponent.js',
//         //     LoadingComponent: 'src/components/LoadingComponent.js',
//         //     MentionedTextComponent: 'src/components/MentionedTextComponent.js',
//         //     MentionsInputComponent: 'src/components/MentionsInputComponent/MentionsInputComponent.js',
//         //     MutualComponent: 'src/components/MutualComponent/MutualComponent.js',
//         //     MutualList: 'src/components/MutualComponent/MutualList.js',
//         //     NavigationToolbar: 'src/components/NavigationToolbar.js',
//         //     NewPostComponent: 'src/components/NewPostComponent/NewPostComponent.js',
//         //     PlacesTextField: 'src/components/PlacesTextField.js',
//         //     PostComponent: 'src/components/PostComponent/PostComponent.js',
//         //     ProgressView: 'src/components/ProgressView.js',
//         //     ProfileComponent: 'src/components/ProfileComponent.js',
//         //     ShareComponent: 'src/components/ShareComponent.js',
//         //     MetaInfoView: 'src/components/MetaInfoView.js',
//         //     UploadComponent: 'src/components/UploadComponent/UploadComponent.js',
//         //
//         //     // layouts
//         //     BottomToolbarLayout: 'src/layouts/BottomToolbarLayout/BottomToolbarLayout.js',
//         //     ResponsiveDrawerLayout: 'src/layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout.js',
//         //     TopBottomMenuLayout: 'src/layouts/TopBottomMenuLayout/TopBottomMenuLayout.js',
//         //
//         //     // pages
//         //     Alerts: 'src/alerts/Alerts.js',
//         //     // AlertsCounter: 'src/alerts/AlertsCounter.js',
//         //     Activity: 'src/pages/admin/audit/Activity.js',
//         //     Admin: 'src/pages/admin/Admin.js',
//         //     Audit: 'src/pages/admin/audit/Audit.js',
//         //     Chat: 'src/chat/Chat.js',
//         //     Chats: 'src/chat/Chats.js',
//         //     // ChatsCounter: 'src/chat/ChatsCounter.js',
//         //     EditProfile: 'src/pages/EditProfile.js',
//         //     EditTag: 'src/tags/EditTag.js',
//         //     Errors: 'src/pages/admin/audit/Errors.js',
//         //     Login: 'src/pages/Login.js',
//         //     NewPost: 'src/pages/NewPost.js',
//         //     Profile: 'src/pages/Profile.js',
//         //     Post: 'src/pages/Post.js',
//         //     Signup: 'src/pages/Signup.js',
//         //     Tag: 'src/tags/Tag.js',
//         //     Tags: 'src/tags/Tags.js',
//         //     Users: 'src/pages/admin/users/Users.js',
//         //
//         //     // internal
//         //     __alertsVisitReducer: 'src/alerts/alertsVisitReducer.js',
//         //     __alertsCounterReducer: 'src/alerts/alertsCounterReducer.js',
//         //     __auditReducer: 'src/pages/admin/audit/auditReducer.js',
//         //     __chatsCounterReducer: 'src/chat/chatsCounterReducer.js',
//         //     __chatMeta: 'src/chat/ChatMeta.js',
//         //     __dateTimePicker: 'src/components/DateTimePicker/DateTimePicker.js',
//         //     __firebase: 'src/controllers/Firebase.js',
//         //     __lazyMentionsInputComponent: 'src/components/MentionsInputComponent/LazyMentionsComponent.js',
//         //     __mainContent: 'src/components/MainContent.js',
//         //     __mutualComponentControls: 'src/components/MutualComponent/mutualComponentControls.js',
//         //     __mutualConstants: 'src/components/MutualComponent/MutualConstants.js',
//         //     __newPostComponentReducer: 'src/components/NewPostComponent/newPostComponentReducer.js',
//         //     __notifications: 'src/controllers/Notifications.js',
//         //     __passwordField: 'src/components/PasswordField.js',
//         //     __richSnackbarContent: 'src/components/RichSnackbarContent.js',
//         //     __serviceWorker: 'src/serviceWorker.js',
//         //     __snackbar: 'src/components/Snackbar.js',
//         //     __store: 'src/controllers/Store.js'
//         // },
//         input: [
//             "src/alerts/index.js",
//             "src/chat/index.js",
//             "src/components/index.js",
//             "src/controllers/index.js",
//             "src/layouts/index.js",
//             "src/pages/index.js",
//             "src/tags/index.js",
//         ],
//         external: ['react', 'react-dom', 'react-datepicker-t', 'react-smart-gallery', 'react-image-lightbox', 'react-image-lightbox', 'react-image-lightbox/style.css', 'react-datepicker-t/dist/react-datepicker.css'],
//         output: [
//             {
//                 dir: 'core',
//                 exports: 'named',
//                 format: 'cjs',
//                 sourcemap: true,
//                 preserveModules: true,
//                 preserveModulesRoot: "src"
//             }
//         ],
//         plugins: [
//             external(),
//             url(),
//             babel(),
//             resolve(),
//             commonjs(),
//             json(),
//         ]
//     }
// ]
