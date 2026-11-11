const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
  const body = await response.json()
  if (!response.ok) throw new Error(`Emulator seed failed: ${response.status} ${JSON.stringify(body)}`)
  return body
}

export function validateSeedConfig({ accounts, password }) {
  if (!Array.isArray(accounts) || !accounts.length || typeof password !== 'string' || !password ||
        accounts.some(account => !account || !/^[A-Za-z0-9_-]+$/.test(account.localId) ||
            [account.email, account.displayName, account.role].some(value => typeof value !== 'string' || !value)) ||
        new Set(accounts.map(account => account.localId)).size !== accounts.length ||
        new Set(accounts.map(account => account.email)).size !== accounts.length) {
    throw new Error('Seed requires distinct accounts with localId, email, displayName, role and a password.')
  }
}

export default async function seedEmulator({ project, urls, accounts, password, expectedProject, namespace = `${project}-default-rtdb` }) {
  validateSeedConfig({ accounts, password })
  if (typeof project !== 'string' || (!project.startsWith('demo-') && project !== expectedProject) || !urls?.database || !urls?.auth || !/^[A-Za-z0-9-]+$/.test(namespace) ||
        !Object.values(urls).every(url => {
          const parsed = new URL(url)
          return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' &&
                parsed.pathname === '/' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
        })) {
    throw new Error('Seeding is restricted to the expected local project.')
  }
  const databaseURL = `${urls.database}/.json?ns=${namespace}`
  const existing = await request(`${urls.database}/meta/emulatorSeed.json?ns=${namespace}`, {
    headers: { Authorization: 'Bearer owner' }
  })
  if (existing) return
  const users = await request(`${urls.auth}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet`, {
    headers: { Authorization: 'Bearer owner' }
  })
  const fields = { 'meta/emulatorSeed': 1 }
  for (const account of accounts) {
    if (!users.users?.some(user => user.localId === account.localId)) {
      await request(`${urls.auth}/identitytoolkit.googleapis.com/v1/projects/${project}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify({
          localId: account.localId,
          email: account.email,
          displayName: account.displayName,
          password,
          emailVerified: true
        })
      })
    }
    fields[`roles/${account.localId}`] = account.role
    fields[`users_public/${account.localId}`] = {
      name: account.displayName,
      email: account.email,
      emailVerified: true,
      _sort_name: account.displayName.toLowerCase().replaceAll(' ', ''),
      created: Date.now()
    }
  }
  await request(databaseURL, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify(fields)
  })
  console.info(`[Emulator] Test users: ${accounts.map(account => account.email).join(' / ')}; password: ${password}`)
}
