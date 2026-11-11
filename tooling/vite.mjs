import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { loadProjectConfig, selectProjectEnvironment } from './app-config.mjs'
import { defineConfig, transformWithOxc, loadConfigFromFile, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { firebaseRulesBuildPlugin } from './firebase-rules.mjs'

function createFirebaseViteConfig(configUrl, settings) {
  const root = fileURLToPath(new URL('.', configUrl))
  const libraryRoot = fileURLToPath(new URL('../', import.meta.url))
  const { peerDependencies, peerDependenciesMeta = {} } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const { version } = JSON.parse(readFileSync(new URL('./package.json', configUrl), 'utf8'))
  const app = settings.vite || {}
  return defineConfig(({ mode, command }) => {
    const secured = command === 'serve' && settings.server.https
    const emulator = settings.environment === 'emulator' && command === 'serve'
    const sourcemap = app.sourcemap !== false
    const { emulators } = settings
    const emulatorProject = settings.environments.emulator.projectId
    const target = service => `http://127.0.0.1:${emulators[service].port}`
    const httpsOptions = secured
      ? {
          cert: readFileSync(settings.server.cert),
          key: readFileSync(settings.server.key)
        }
      : undefined

    return {
      root,
      base: '/',
      ...(mode === 'test' ? { test: { environment: 'jsdom', globals: true, include: ['src/**/*.test.js'], restoreMocks: true } } : {}),
      worker: {
        format: 'es',
        rolldownOptions: { output: { entryFileNames: '[name]-[hash].js' } }
      },
      plugins: [
        firebaseRulesBuildPlugin(settings.configFile),
        {
          name: 'jsx-in-js',
          enforce: 'pre',
          transform(code, id) {
            const filename = id.split('?')[0]
            if (!filename.startsWith(`${root}src/`) || !filename.endsWith('.js')) return
            return transformWithOxc(code, filename, {
              lang: 'jsx',
              jsx: { runtime: 'automatic', development: command === 'serve', refresh: false }
            })
          }
        },
        react(),
        {
          name: 'app-version',
          transformIndexHtml: {
            order: 'pre',
            handler: html => html.replaceAll('%APP_VERSION%', version)
          }
        },
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'src',
          filename: 'service-worker.js',
          injectRegister: false,
          manifest: false,
          injectManifest: {
            rollupFormat: 'iife',
            globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,json,woff,woff2}'],
            globIgnores: ['firebase-messaging-sw-*.js'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            sourcemap
          },
          devOptions: { enabled: false }
        })
      ],
      define: {
        global: 'globalThis',
        'process.env.PUBLIC_URL': JSON.stringify(''),
        'process.env.REACT_APP_VERSION': JSON.stringify(version)
      },
      optimizeDeps: {
        rolldownOptions: { moduleTypes: { '.js': 'jsx' } }
      },
      resolve: {
        alias: [
          { find: '#firebase-config', replacement: settings.environments[settings.environment].configurationFile },
          ...(mode === 'test' ? [{ find: /^redequate$/, replacement: fileURLToPath(import.meta.resolve('redequate')) }] : [])
        ],
        dedupe: [...Object.keys(peerDependencies).filter(name => !peerDependenciesMeta[name]?.optional), 'firebase', '@firebase/app', '@firebase/auth', '@firebase/database', '@firebase/storage', '@firebase/functions', '@firebase/messaging', '@firebase/analytics', '@firebase/installations', '@firebase/component', '@firebase/util']
      },
      server: {
        headers: {
          'Service-Worker-Allowed': '/',
          ...(emulator ? { 'Content-Security-Policy': 'upgrade-insecure-requests' } : {})
        },
        ...(emulator
          ? {
              proxy: {
                '/identitytoolkit.googleapis.com/': { target: target('auth'), changeOrigin: true },
                '/securetoken.googleapis.com/': { target: target('auth'), changeOrigin: true },
                '/emulator/auth/': { target: target('auth'), changeOrigin: true },
                '/.lp': { target: target('database'), changeOrigin: true },
                '/.ws': { target: target('database'), changeOrigin: true, ws: true },
                '/v0/': { target: target('storage'), changeOrigin: true },
                [`/${emulatorProject}/`]: { target: target('functions'), changeOrigin: true }
              }
            }
          : {}),
        host: settings.server.host,
        allowedHosts: settings.server.allowedHosts,
        port: settings.server.port,
        strictPort: true,
        watch: { usePolling: settings.server.polling },
        fs: { allow: [root, libraryRoot] },
        ...(httpsOptions ? { https: httpsOptions } : {})
      },
      preview: {
        host: settings.server.host,
        port: settings.server.port,
        strictPort: true,
        allowedHosts: settings.server.allowedHosts,
        ...(httpsOptions ? { https: httpsOptions } : {})
      },
      build: {
        outDir: 'build',
        target: ['chrome117', 'edge121', 'firefox121', 'safari17'],
        assetsInlineLimit: 1024,
        sourcemap,
        rolldownOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', configUrl)),
            version: fileURLToPath(new URL('./version.html', configUrl))
          }
        }
      }
    }
  })
}

/** All project settings come from JSON. The optional Vite file contains library customizations only. */
export function createProjectViteConfig(configFile, selection = {}) {
  configFile = resolve(configFile)
  return async context => {
    const project = loadProjectConfig(configFile)
    const requested = selection.environment ?? process.env.REDEQUATE_ENVIRONMENT
    const target = requested ?? (['test', 'integration'].includes(context.mode)
      ? (context.mode === 'integration' ? 'emulator' : project.testing.unitEnvironment ?? project.defaultEnvironment)
      : Object.keys(project.environments).find(name => project.environments[name].mode === context.mode) ?? project.defaultEnvironment)
    const settings = selectProjectEnvironment(project, target)
    if (selection.https !== undefined) settings.server.https = selection.https
    else if (requested && process.env.REDEQUATE_HTTPS !== undefined) settings.server.https = process.env.REDEQUATE_HTTPS === 'true'
    // Vitest does not serve HTTPS and must not require developer certificates.
    if (['test', 'integration'].includes(context.mode)) settings.server.https = false
    const generated = resolve(settings.root, '.firebase/generated')
    mkdirSync(generated, { recursive: true })
    const endpoints = Object.fromEntries(['auth', 'database', 'functions', 'storage'].map(name => [name, settings.emulators[name]]))
    const endpointFile = resolve(generated, 'emulators.json')
    const content = JSON.stringify(endpoints, null, 4) + '\n'
    if (!existsSync(endpointFile) || readFileSync(endpointFile, 'utf8') !== content) writeFileSync(endpointFile, content)
    const localFile = resolve(settings.root, 'vite.config.mjs')
    const local = existsSync(localFile) ? (await loadConfigFromFile(context, localFile, settings.root)).config : {}
    for (const key of ['port', 'host', 'https', 'allowedHosts', 'watch', 'proxy']) {
      if (local.server?.[key] !== undefined) throw new Error(`Move server.${key} from Vite to redequate.config.json.`)
    }
    if (local.build?.outDir !== undefined) throw new Error('Project output belongs to Redequate, not the Vite customization.')
    settings.vite = { sourcemap: local.build?.sourcemap ?? true }
    const configUrl = pathToFileURL(configFile).href
    const base = createFirebaseViteConfig(configUrl, settings)(context)
    return mergeConfig(base, local)
  }
}

/** Vite CLI entry; importing the preset does not load an application. */
export default context => {
  if (!process.env.REDEQUATE_CONFIG) throw new Error('Start Vite through Redequate with --config redequate.config.json.')
  return createProjectViteConfig(process.env.REDEQUATE_CONFIG)(context)
}
