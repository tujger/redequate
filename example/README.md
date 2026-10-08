# Redequate example

A small React 19 example built with Vite. It demonstrates Button and TextField
without Firebase configuration or external application repositories.

Use Node.js 24.12 or later. Build the framework first with
`npm run "build core"` from the repository root, then run:

```sh
cd example
npm ci --legacy-peer-deps
npm start
npm run build
npm run serve
```

The example uses `/redequate/` as its base for GitHub Pages and writes assets to
`example/build`. Open the URL printed by Vite, including that base path.
Existing publication commands remain available; no deployment is automatic.
