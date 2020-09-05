import babel from 'rollup-plugin-babel'
import commonjs from 'rollup-plugin-commonjs'
import external from 'rollup-plugin-peer-deps-external'
import postcss from 'rollup-plugin-postcss'
import resolve from 'rollup-plugin-node-resolve'
import url from 'rollup-plugin-url'
import svgr from '@svgr/rollup'
import del from 'rollup-plugin-delete'

import pkg from './package.json'

export default [{
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
        del({targets: ['dist/*']}),
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
            Chat: 'src/chat/Chat.js',
            Chats: 'src/chat/Chats.js',
            ChatsCounter: 'src/chat/ChatsCounter.js',
            Dispatcher: 'src/Dispatcher.js',
            EditProfile: 'src/pages/EditProfile.js',
            Login: 'src/pages/Login.js',
            UploadComponent: 'src/components/UploadComponent/UploadComponent.js',
            Users: 'src/pages/admin/Users.js',
            DateTimePicker: 'src/components/DateTimePicker/index.js'
        },
        output: [
            {
                dir: 'dist',
                exports: 'named',
                format: 'cjs',
                sourcemap: true
            }/*,
            {
                dir: 'dist/es',
                exports: 'named',
                format: 'es',
                sourcemap: true
            }*/
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
