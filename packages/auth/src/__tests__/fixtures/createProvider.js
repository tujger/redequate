// Providers are created independently; dependencies are linked after construction.
export default function createProvider(Auth, {database, ...options} = {}) {
    const auth = new Auth(options);
    if (database !== undefined) auth.setDatabase(database);
    return auth;
}
