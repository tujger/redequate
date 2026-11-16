import { existsSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const marker = settings => join(settings.root, 'build/.redequate-build.json')
export const buildRulesSnapshot = settings => join(settings.root, 'build/.redequate-rules.json')
const digest = value => createHash('sha256').update(value).digest('hex')
export const invalidateBuild = settings => rmSync(marker(settings), { force: true })

export function recordBuild(settings, environment) {
  if (!existsSync(join(settings.root, 'build/index.html'))) throw new Error('Build did not produce build/index.html.')
  const rules = readFileSync(join(settings.root, '.firebase/generated/database.rules.json'))
  JSON.parse(rules)
  writeFileSync(buildRulesSnapshot(settings), rules)
  const projectId = settings.environments[environment].projectId
  const file = marker(settings)
  const temporary = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, JSON.stringify({ version: 2, environment, projectId, rulesSha256: digest(rules) }) + '\n', { flag: 'wx' })
    renameSync(temporary, file)
  } finally { rmSync(temporary, { force: true }) }
}

export function readBuild(settings) {
  let artifact
  try { artifact = JSON.parse(readFileSync(marker(settings), 'utf8')) } catch {
    throw new Error('No confirmed build. Run build for the required environment first.')
  }
  if (artifact?.version !== 2 || typeof artifact.environment !== 'string' || artifact.environment === 'emulator' ||
      !settings.environments[artifact.environment] || settings.environments[artifact.environment].projectId !== artifact.projectId) {
    throw new Error('Build target no longer matches redequate.config.json. Rebuild before serving or deploying.')
  }
  if (!existsSync(join(settings.root, 'build/index.html'))) throw new Error('Build output is missing. Rebuild first.')
  let rules
  try { rules = readFileSync(buildRulesSnapshot(settings)) } catch { throw new Error('Build Rules snapshot is missing. Rebuild first.') }
  if (digest(rules) !== artifact.rulesSha256) throw new Error('Build Rules snapshot changed. Rebuild before serving or deploying.')
  return artifact
}
