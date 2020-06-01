# edeqa-pwa-react-core

> Edeqa PWA React core

[![NPM](https://img.shields.io/npm/v/edeqa-pwa-react-core.svg)](https://www.npmjs.com/package/edeqa-pwa-react-core) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save edeqa-pwa-react-core
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


## License


MIT © [tujger](https://github.com/tujger)
