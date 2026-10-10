import {babel} from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import {nodeResolve as resolve} from '@rollup/plugin-node-resolve'
import url from '@rollup/plugin-url'
import svgr from '@svgr/rollup'
import {readFileSync} from 'node:fs'
import postcssNested from 'postcss-nested'
import del from 'rollup-plugin-delete'
import external from 'rollup-plugin-peer-deps-external'
import postcss from 'rollup-plugin-postcss'
import {authSourcePattern, withAuth} from './packages/auth/build.mjs'
import {messagingSourcePattern, withMessaging} from "./packages/messaging/build.mjs";
import {storageSourcePattern, withStorage} from './packages/storage/build.mjs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const externalExports = ['react', 'react-dom', 'react-datepicker', 'react-smart-gallery', 'react-image-lightbox', 'react-image-lightbox/style.css', 'react-datepicker/dist/react-datepicker.css', /^@mui\/icons-material(?:\/|$)/, /^@uppy(?:\/|$)/];

const postCssModules = {
    include: '**/*.module.css',
    modules: true,
    sourceMap: true,
    plugins: [postcssNested()],
};

const postCssRaw = {
    include: '**/*.css',
    exclude: '**/*.module.css',
    modules: false,
    inject: false,
    plugins: [postcssNested()]
};

const babelIosPwaPrompt = {
    include: '**/node_modules/react-ios-pwa-prompt/**',
    babelrc: false,
    babelHelpers: 'bundled',
    presets: ['@babel/preset-env'],
    plugins: [
        '@babel/plugin-transform-nullish-coalescing-operator',
        '@babel/plugin-transform-optional-chaining',
    ],
}

export default () => {
    return [
        {
            input: {index: 'src/index.js'},
            external: externalExports,
            output: [{
                dir: 'core',
                format: 'es',
                entryFileNames: chunk => chunk.name === 'index' ? pkg.module.split('/').pop() : '[name].es.js',
                chunkFileNames: 'chunks/[name]-[hash].es.js',
                sourcemap: true,
            }],
            plugins: [
                ...(!process.env.ROLLUP_WATCH ? [del({targets: ['core/*']})] : []),
                external(),
                postcss(postCssModules),
                postcss(postCssRaw),
                url(),
                // Source JSX must be transpiled before CommonJS parses these modules.
                babel({
                    babelHelpers: 'bundled',
                    include: ['src/**', 'packages/_common/src/**', authSourcePattern, messagingSourcePattern, storageSourcePattern],
                }),
                svgr(),
                resolve(),
                commonjs(),
                babel(babelIosPwaPrompt),
                json(),
            ]
        },
        {
            input: {
                index: 'src/index.js',
                Dispatcher: 'src/Dispatcher.js',

                // controllers
                DateFormat: 'src/controllers/DateFormat.js',
                FirebasePagination: 'src/controllers/FirebasePagination.js',
                General: 'src/controllers/General.js',
                lazyListComponentReducer: 'src/components/LazyListComponent/lazyListComponentReducer.js',
                mentionTypes: 'src/controllers/mentionTypes.js',
                notifySnackbar: 'src/controllers/notifySnackbar.js',
                postItemTransform: 'src/components/PostComponent/postItemTransform.js',
                PostData: 'src/components/PostComponent/PostData.js',
                UserData: 'src/controllers/UserData.js',
                WrapperControl: 'src/controllers/WrapperControl.js',
                uploadComponentControls: 'src/components/UploadComponent/uploadComponentControls',

                Firebase: 'src/controllers/Firebase.js',

                // controls
                Button: 'src/controls/Button/Button.js',
                Chip: 'src/controls/Chip/Chip.js',
                Menu: 'src/controls/Menu/Menu.js',
                Select: 'src/controls/Select/Select.js',
                Switch: 'src/controls/Switch/Switch.js',
                Tabs: 'src/controls/Tabs/Tabs.js',
                TextField: 'src/controls/TextField/TextField.js',
                UserName: 'src/controls/UserName/UserName.js',

                // components
                AvatarView: 'src/components/AvatarView.js',
                ButtonAddEvent: 'src/components/ButtonAddEvent.js',
                ConfirmComponent: 'src/components/ConfirmComponent.js',
                DateTimePicker: 'src/components/DateTimePicker/index.js',
                HeaderComponent: 'src/components/HeaderComponent.js',
                ItemPlaceholderComponent: 'src/components/ItemPlaceholderComponent.js',
                JoinUsComponent: 'src/components/JoinUsComponent.js',
                LazyListComponent: 'src/components/LazyListComponent/LazyListComponent.js',
                LoadingComponent: 'src/components/LoadingComponent.js',
                MentionedTextComponent: 'src/components/MentionedTextComponent.js',
                MentionsInputComponent: 'src/components/MentionsInputComponent/MentionsInputComponent.js',
                MutualComponent: 'src/components/MutualComponent/MutualComponent.js',
                MutualList: 'src/components/MutualComponent/MutualList.js',
                NavigationToolbar: 'src/components/NavigationToolbar.js',
                NewPostComponent: 'src/components/NewPostComponent/NewPostComponent.js',
                PlacesTextField: 'src/components/PlacesTextField.js',
                PostComponent: 'src/components/PostComponent/PostComponent.js',
                ProgressView: 'src/components/ProgressView.js',
                ProfileComponent: 'src/components/ProfileComponent.js',
                ShareComponent: 'src/components/ShareComponent.js',
                SystemAlert: 'src/components/SystemAlert.js',
                UploadComponent: 'src/components/UploadComponent/UploadComponent.js',

                // layouts
                BottomToolbarLayout: 'src/layouts/BottomToolbarLayout/BottomToolbarLayout.js',
                ResponsiveDrawerLayout: 'src/layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout.js',
                TopBottomMenuLayout: 'src/layouts/TopBottomMenuLayout/TopBottomMenuLayout.js',

                // pages
                Alerts: 'src/alerts/Alerts.js',
                // AlertsCounter: 'src/alerts/AlertsCounter.js',
                Activity: 'src/pages/admin/audit/Activity.js',
                Admin: 'src/pages/admin/Admin.js',
                Audit: 'src/pages/admin/audit/Audit.js',
                Chat: 'src/chat/Chat.js',
                Chats: 'src/chat/Chats.js',
                // ChatsCounter: 'src/chat/ChatsCounter.js',
                EditProfile: 'src/pages/EditProfile.js',
                EditTag: 'src/tags/EditTag.js',
                Errors: 'src/pages/admin/audit/Errors.js',
                Login: 'src/pages/Login.js',
                NewPost: 'src/pages/NewPost.js',
                Profile: 'src/pages/Profile.js',
                Post: 'src/pages/Post.js',
                Signup: 'src/pages/Signup.js',
                Tag: 'src/tags/Tag.js',
                Tags: 'src/tags/Tags.js',
                Users: 'src/pages/admin/users/Users.js',

                // themes
                Theme: 'src/themes/Theme/index.js',
                ThemeSeason: 'src/themes/ThemeSeason/index.js',
                ThemeDayNight: 'src/themes/ThemeDayNight/index.js',

                // internal
                __alertsVisitReducer: 'src/alerts/alertsVisitReducer.js',
                __alertsCounterReducer: 'src/alerts/alertsCounterReducer.js',
                __auditReducer: 'src/pages/admin/audit/auditReducer.js',
                __chatsCounterReducer: 'src/chat/chatsCounterReducer.js',
                __chatMeta: 'src/chat/ChatMeta.js',
                __dateTimePicker: 'src/components/DateTimePicker/DateTimePicker.js',
                __lazyMentionsInputComponent: 'src/components/MentionsInputComponent/LazyMentionsComponent.js',
                __mutualComponentControls: 'src/components/MutualComponent/mutualComponentControls.js',
                __mutualConstants: 'src/components/MutualComponent/MutualConstants.js',
                __newPostComponentReducer: 'src/components/NewPostComponent/newPostComponentReducer.js',
                __notifications: 'src/controllers/Notifications.js',
                __passwordField: 'src/components/PasswordField.js',
                __richSnackbarContent: 'src/components/RichSnackbarContent.js',
                __serviceWorker: 'src/serviceWorker.js',
                __snackbar: 'src/components/Snackbar.js',
                __store: 'src/controllers/Store.js'
            },
            external: externalExports,
            output: [
                {
                    dir: 'core',
                    exports: 'named',
                    format: 'cjs',
                    entryFileNames: '[name].js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    interop: 'auto',
                    sourcemap: true
                }
            ],
            plugins: [
                external(),
                postcss(postCssModules),
                postcss(postCssRaw),
                url(),
                // Source JSX must be transpiled before CommonJS parses these modules.
                babel({
                    babelHelpers: 'bundled',
                    include: ['src/**', 'packages/_common/src/**', authSourcePattern, messagingSourcePattern, storageSourcePattern],
                }),
                resolve(),
                commonjs(),
                babel(babelIosPwaPrompt),
                json(),
            ]
        }
    ].map(withAuth).map(withMessaging).map(withStorage)
}
