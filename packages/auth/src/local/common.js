import {delay, fail, identifier} from "../../../common";
import {readState, writeState} from "./database";
import initialProfile from "../common/initialProfile";

export const changeEvent = "redequate:local-auth-changed";

export const channelName = "redequate:local:auth";

export const normalizeEmail = email => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail("auth/invalid-email", "Invalid email address.");
    return email.trim().toLowerCase();
};

export const checkPassword = password => {
    if (password.length < 6) fail("auth/weak-password", "Password must contain at least six characters.");
};

const validAccount = account => account && typeof account.key === "string" && account.key &&
    typeof account.email === "string" && typeof account.emailVerified === "boolean" &&
    (account.password === null || typeof account.password === "string") && typeof account.provider === "string" &&
    (account.name === null || typeof account.name === "string") && (account.image === null || typeof account.image === "string") &&
    Number.isFinite(account.created) && Number.isFinite(account.lastLogin);

const validRecord = record => record && typeof record.key === "string" && record.key && typeof record.email === "string";

export const read = async auth => {
    const state = await readState(auth);
    const valid = (state.revision === null || typeof state.revision === "string") &&
        state.accounts.every(validAccount) && state.links.every(validRecord) &&
        state.mail.every(record => validRecord(record) && typeof record.type === "string" && Number.isFinite(record.created)) &&
        (state.session === null || (typeof state.session.token === "string" && state.accounts.some(account => account.key === state.session.key))) &&
        (state.redirect === null || state.accounts.some(account => account.key === state.redirect));
    if (!valid) fail("auth/invalid-storage", "Invalid local authentication records.");
    return state;
};

export const notify = (auth, revision) => {
    const message = {namespace: auth.storageKey, revision};
    window.dispatchEvent(new CustomEvent(changeEvent, {detail: auth.storageKey}));
    if (globalThis.BroadcastChannel) {
        const channel = new globalThis.BroadcastChannel(channelName);
        try { channel.postMessage(message); } finally { channel.close(); }
    }
};

export const write = async (auth, state, {notify: publish = true, ...options} = {}) => {
    const saved = await writeState(auth, state, options);
    if (saved && publish) notify(auth, saved.revision);
    return saved;
};

export const current = (auth, state) => auth._requireCurrentUser(state.accounts.find(account => account.key === state.session?.key));

export function toUserData(account, createUserData) {
    if (!account) return createUserData();
    return createUserData({
        id: account.key,
        public: {
            name: account.name ?? null,
            email: account.email ?? null,
            emailVerified: Boolean(account.emailVerified),
            image: account.image ?? null,
            provider: account.provider || "password",
            created: account.created,
            lastLogin: account.lastLogin,
        },
    });
}

export function createAccount(email, provider = "password", password = null) {
    return {
        key: identifier(),
        email,
        provider,
        password,
        emailVerified: provider !== "password",
        name: null,
        image: null,
        created: Date.now(),
        lastLogin: 0
    };
}

const saveNewProfile = async props => {
    const {auth, account, createUserData, previous, lastLogin} = props;
    const identity = toUserData({...account, lastLogin}, createUserData);
    if (!previous.accounts.some(item => item.key === account.key)) {
        await auth._saveProfile(identity, account.provider === "password"
            ? initialProfile(identity) : {public: identity.public, private: identity.private});
    }
    return props;
};

const installSession = async props => {
    const {auth, state, account, lastLogin} = props;
    const next = {
        ...state,
        accounts: state.accounts.map(item => item.key === account.key ? {...item, lastLogin} : item),
        session: {key: account.key, token: `local:${identifier()}`}
    };
    const pending = await write(auth, next, {notify: false});
    return {...props, pending};
};

const resolveSession = async props => {
    const {auth, pending, previous} = props;
    try {
        const user = await auth.resolveCurrentUser({skipDelay: true});
        if ((await read(auth)).revision !== pending.revision) fail("auth/state-changed", "Local authentication changed during sign-in.");
        notify(auth, pending.revision);
        return user;
    } catch (error) {
        await write(auth, previous, {notify: false, restore: true, expectedRevision: pending.revision});
        throw error;
    }
};

export const login = (auth, state, account, createUserData) => {
    const previousRevision = state.revision;
    // Callers prepare account/link changes in memory; the persisted snapshot owns rollback.
    return read(auth).then(stored => {
        if (stored.revision !== previousRevision) fail("auth/state-changed", "Local authentication changed during sign-in.");
        return saveNewProfile({auth, state, account, createUserData, previous: stored, lastLogin: Date.now()});
    }).then(installSession).then(resolveSession);
};

export function providerAccount(state, provider) {
    const providerId = typeof provider === "string" ? provider : provider?.providerId;
    const name = typeof providerId === "string" ? providerId.replace(/\.com$/, "") : null;
    if (name !== "google" && name !== "facebook") {
        fail("auth/operation-not-supported", "Only simulated Google and Facebook providers are supported.");
    }
    const email = `${name}@local.example`;
    let account = state.accounts.find(item => item.email === email);
    if (account && account.provider !== `${name}.com`) {
        fail("auth/account-exists-with-different-credential", "The simulated provider email is already registered.");
    }
    if (!account) {
        account = createAccount(email, `${name}.com`);
        account.name = `Local Test ${name === "google" ? "Google" : "Facebook"}`;
        state.accounts.push(account);
    }
    return account;
}

export function recordMail(state, type, email, options) {
    state.mail.push({
        key: identifier(),
        type,
        email,
        created: Date.now(),
        ...(typeof options?.url === "string" ? {url: options.url} : {}),
        ...(typeof options?.handleCodeInApp === "boolean" ? {handleCodeInApp: options.handleCodeInApp} : {})
    });
}

export async function changePassword(auth, password) {
    await delay("LocalAuth", "updatePassword");
    checkPassword(password);
    const state = await read(auth);
    const account = current(auth, state);
    account.password = password;
    await write(auth, state);
}
