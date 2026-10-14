import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, copyFileSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.argv.length !== 3) {
  throw new Error('Usage: node prepare-redequate-server.mjs <functions-directory>')
}

const functionsDir = resolve(process.argv[2])
const serverDir = dirname(fileURLToPath(import.meta.url))
const frameworkDir = resolve(serverDir, '../..')
const vendorDir = join(functionsDir, 'vendor')

if (!existsSync(join(functionsDir, 'package.json'))) {
  throw new Error(`Functions package not found at ${functionsDir}. Pass a directory containing package.json.`)
}

const temporaryDir = mkdtempSync(join(tmpdir(), 'functions-server-'))
const npm = (args, options) => process.env.npm_execpath
  ? execFileSync(process.execPath, [process.env.npm_execpath, ...args], options)
  : execFileSync('npm', args, options)

try {
  npm(['run', 'build server'], { cwd: frameworkDir, stdio: 'inherit' })
  const output = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryDir], {
    cwd: serverDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
  const [packed] = JSON.parse(output)
  mkdirSync(vendorDir, { recursive: true })
  const archive = join(vendorDir, 'redequate-server.tgz')
  copyFileSync(join(temporaryDir, packed.filename), `${archive}.tmp`)
  renameSync(`${archive}.tmp`, archive)
  // Explicitly reinstall the tarball so a changed archive refreshes lockfile integrity.
  npm(['install', 'redequate@file:vendor/redequate-server.tgz', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: functionsDir,
    stdio: 'inherit'
  })
  console.log('Functions server package and lockfile prepared.')
} finally {
  rmSync(temporaryDir, { recursive: true, force: true })
}
