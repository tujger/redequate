export const changeEvent = "redequate:local-test-auth-changed";
export const fail = (code, message) => {
    throw Object.assign(new Error(message), {code: `auth/${code}`});
};
const emptyState = () => ({version: 1, accounts: [], session: null, redirect: null, links: [], mail: []});
export const normalizeEmail = email => {
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        fail("invalid-email", "Invalid email address.");
    }
    return email.trim().toLowerCase();
};
export const checkPassword = password => {
    if (typeof password !== "string" || password.length < 6) {
        fail("weak-password", "Password must contain at least six characters.");
    }
};
export const identifier = () => window.crypto.randomUUID();
const validAccount = account => account && typeof account.uid === "string" &&
    typeof account.email === "string" && typeof account.emailVerified === "boolean" &&
    (account.password === null || typeof account.password === "string") &&
    typeof account.provider === "string" &&
    (account.displayName === null || typeof account.displayName === "string") &&
    (account.photoURL === null || typeof account.photoURL === "string") &&
    Number.isFinite(account.createdAt) && Number.isFinite(account.lastLoginAt);
const validState = state => state && state.version === 1 && Array.isArray(state.accounts) &&
    state.accounts.every(validAccount) &&
    new Set(state.accounts.map(account => account.uid)).size === state.accounts.length &&
    new Set(state.accounts.map(account => account.email)).size === state.accounts.length &&
    (state.session === null || (state.session && typeof state.session.token === "string" &&
        state.accounts.some(account => account.uid === state.session.uid))) &&
    (state.redirect === null || state.accounts.some(account => account.uid === state.redirect)) &&
    Array.isArray(state.links) && state.links.every(email => typeof email === "string") &&
    Array.isArray(state.mail) && state.mail.every(item => item && typeof item.type === "string" &&
        typeof item.email === "string" && Number.isFinite(item.timestamp));

export async function delay(method) {
    const milliseconds = Math.floor(Math.random() * 2001);
    if (milliseconds > 100) console.debug(`[LocalTestAuth] ${method}: ${milliseconds} ms`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function read(auth) {
    let raw;
    try {
        raw = window.localStorage.getItem(auth.storageKey);
    } catch (error) {
        fail("storage-unavailable", `Cannot read localStorage: ${error.message}`);
    }
    if (raw === null) return emptyState();
    try {
        const state = JSON.parse(raw);
        if (!validState(state)) throw new Error("Invalid storage format.");
        return state;
    } catch (error) {
        fail("invalid-storage", `Cannot restore local authentication: ${error.message}`);
    }
}

export function write(auth, state) {
    try {
        window.localStorage.setItem(auth.storageKey, JSON.stringify(state));
    } catch (error) {
        fail("storage-unavailable", `Cannot write localStorage: ${error.message}`);
    }
    window.dispatchEvent(new CustomEvent(changeEvent, {detail: auth.storageKey}));
}

export function current(state) {
    const account = state.accounts.find(item => item.uid === state.session?.uid);
    if (!account) fail("no-current-user", "An authenticated user is required.");
    return account;
}

export function createUser(auth, account) {
    if (!account) return null;
    const json = {
        uid: account.uid,
        email: account.email,
        emailVerified: account.emailVerified,
        displayName: account.displayName,
        photoURL: account.photoURL,
        providerData: [{
            providerId: account.provider,
            uid: account.uid,
            email: account.email,
            displayName: account.displayName,
            photoURL: account.photoURL
        }],
        createdAt: String(account.createdAt),
        lastLoginAt: String(account.lastLoginAt),
    };
    return {
        ...json,
        toJSON: () => ({...json, providerData: json.providerData.map(item => ({...item}))}),
        updatePassword: password => changePassword(auth, password, account.uid),
    };
}

export function createAccount(email, provider = "password", password = null) {
    return {
        uid: identifier(),
        email,
        provider,
        password,
        emailVerified: provider !== "password",
        displayName: null,
        photoURL: null,
        createdAt: Date.now(),
        lastLoginAt: 0
    };
}

export function login(auth, state, account) {
    account.lastLoginAt = Date.now();
    state.session = {uid: account.uid, token: `local-test:${identifier()}`};
    write(auth, state);
    return {user: createUser(auth, account)};
}

export function providerAccount(state, provider) {
    const providerId = typeof provider === "string" ? provider : provider?.providerId;
    const name = typeof providerId === "string" ? providerId.replace(/\.com$/, "") : null;
    if (name !== "google" && name !== "facebook") {
        fail("operation-not-supported", "Only simulated Google and Facebook providers are supported.");
    }
    const email = `${name}@local-test.example`;
    let account = state.accounts.find(item => item.email === email);
    if (account && account.provider !== `${name}.com`) {
        fail("account-exists-with-different-credential", "The simulated provider email is already registered.");
    }
    if (!account) {
        account = createAccount(email, `${name}.com`);
        account.displayName = `Local Test ${name === "google" ? "Google" : "Facebook"}`;
        state.accounts.push(account);
    }
    return account;
}

export function recordMail(state, type, email, options) {
    state.mail.push({
        type,
        email,
        timestamp: Date.now(),
        ...(typeof options?.url === "string" ? {url: options.url} : {})
    });
}

export async function changePassword(auth, password, uid) {
    await delay("updatePassword");
    checkPassword(password);
    const state = read(auth);
    const account = current(state);
    if (uid !== undefined && account.uid !== uid) fail("user-mismatch", "This user is no longer signed in.");
    account.password = password;
    write(auth, state);
}
