import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import external from 'rollup-plugin-peer-deps-external'
import postcss from 'rollup-plugin-postcss'
import resolve from 'rollup-plugin-node-resolve'
import url from 'rollup-plugin-url'
import svgr from '@svgr/rollup'
import del from 'rollup-plugin-delete'

import pkg from './package.json'

export default [
    {
        input: 'src/index.js',
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true
            }/*,
        {
            file: pkg.module,
            format: 'es',
            sourcemap: true
        }*/
        ],
        plugins: [
            del({targets: ['core/*']}),
            external(),
            postcss({
                modules: true
            }),
            url(),
            svgr(),
            babel(),
            resolve(),
            commonjs()
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
            notifySnackbar: 'src/controllers/notifySnackbar.js',
            lazyListComponentReducer: 'src/components/LazyListComponent/lazyListComponentReducer.js',
            UserData: 'src/controllers/UserData.js',
            WrapperControl: 'src/controllers/WrapperControl.js',
            Theme: 'src/controllers/Theme.js',

            // components
            AvatarView: 'src/components/AvatarView.js',
            ButtonAddEvent: 'src/components/ButtonAddEvent.js',
            ConfirmComponent: 'src/components/ConfirmComponent.js',
            DateTimePicker: 'src/components/DateTimePicker/index.js',
            HeaderComponent: 'src/components/HeaderComponent.js',
            ItemPlaceholderComponent: 'src/components/ItemPlaceholderComponent.js',
            LazyListComponent: 'src/components/LazyListComponent/LazyListComponent.js',
            LoadingComponent: 'src/components/LoadingComponent.js',
            // MentionsComponent: 'src/components/MentionsComponent/MentionsComponent.js',
            MutualComponent: 'src/components/MutualComponent/MutualComponent.js',
            MutualList: 'src/components/MutualComponent/MutualList.js',
            NavigationToolbar: 'src/components/NavigationToolbar.js',
            PlacesTextField: 'src/components/PlacesTextField.js',
            ProgressView: 'src/components/ProgressView.js',
            ProfileComponent: 'src/components/ProfileComponent.js',
            ShareComponent: 'src/components/ShareComponent.js',
            TechnicalInfoView: 'src/components/TechnicalInfoView.js',
            UploadComponent: 'src/components/UploadComponent/UploadComponent.js',

            // layouts
            BottomToolbarLayout: 'src/layouts/BottomToolbarLayout/BottomToolbarLayout.js',
            ResponsiveDrawerLayout: 'src/layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout.js',
            TopBottomMenuLayout: 'src/layouts/TopBottomMenuLayout/TopBottomMenuLayout.js',

            // pages
            Alerts: 'src/alerts/Alerts.js',
            // AlertsCounter: 'src/alerts/AlertsCounter.js',
            Admin: 'src/pages/admin/Admin.js',
            Audit: 'src/pages/admin/Audit.js',
            Chat: 'src/chat/Chat.js',
            Chats: 'src/chat/Chats.js',
            // ChatsCounter: 'src/chat/ChatsCounter.js',
            EditProfile: 'src/pages/EditProfile.js',
            Errors: 'src/pages/admin/Errors.js',
            Login: 'src/pages/Login.js',
            Profile: 'src/pages/Profile.js',
            Signup: 'src/pages/Signup.js',
            Users: 'src/pages/admin/users/Users.js',

            // internal
            __firebase: 'src/controllers/Firebase.js'
        },
        output: [
            {
                dir: 'core',
                exports: 'named',
                format: 'cjs',
                sourcemap: true
            }
        ],
        plugins: [
            external(),
            url(),
            babel(),
            resolve(),
            commonjs()
        ]
    }
]
