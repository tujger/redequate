import {fail, notImplemented, UserData as DefaultUserData, UserRole} from "../../common";
import type {UserData} from "../../common";
import type DatabaseBase from "../../database/src/common/DatabaseBase";
import type {DatabaseValue} from "../../database/src/common/DatabaseTypes";
import saveUserData from "./common/saveUserData";
import loadUserData from "./common/loadUserData";
import {
    validateString, validateEmailOptions, validateProvider, validateProviderOptions,
    validateCurrentUserOptions, validateCallbacks, validateProfile, validateConstructorOptions
} from "./common/validateArguments";

export interface AuthProfileSection {
    [field: string]: DatabaseValue | AuthProfileSection | undefined;
}

export interface AuthProfileFields {
    public?: AuthProfileSection;
    role?: string | null;
    private?: AuthProfileSection;
}

export interface AuthEmailOptions {
    url?: string;
    handleCodeInApp?: boolean;
    [option: string]: unknown;
}

export interface AuthProviderOptions {
    scopes?: string[];
    parameters?: Record<string, string>;
    [option: string]: unknown;
}

export interface AuthCurrentUserOptions {
    skipDelay?: boolean;
}

export type AuthProvider = string | object;
export type AuthCredential = string | object;
export type AuthUnsubscribe = () => void;
export type AuthStateCallback<User extends UserData = UserData> = (user: User) => void | Promise<void>;
export type AuthErrorCallback = (error: unknown) => void;

export interface AuthUserDataJSON {
    id: string;
    role?: string | null;
    public: Record<string, DatabaseValue>;
    private?: Record<string, DatabaseValue>;
    requested?: number;
    loaded?: Record<string, boolean>;
}

export interface AuthUserDataConstructor<User extends UserData = UserData> {
    new(database?: DatabaseBase): User;
}

export interface AuthOptions<User extends UserData = UserData> {
    database?: DatabaseBase;
    UserData?: AuthUserDataConstructor<User>;
}

/** Async contract implemented by providers; AuthBase methods validate their arguments. */
export interface AuthImplementation<User extends UserData = UserData> {
    checkSignInWithEmailLink(): Promise<boolean>;
    createUserWithEmailAndPassword(email: string, password: string): Promise<User>;
    onAuthStateChanged(callback: AuthStateCallback<User>, onError?: AuthErrorCallback): Promise<AuthUnsubscribe>;
    resolveRedirectResult(): Promise<User | null>;
    resolveCurrentUser(options?: AuthCurrentUserOptions): Promise<User>;
    sendEmailVerification(options?: AuthEmailOptions): Promise<void>;
    sendPasswordResetEmail(email: string, options?: AuthEmailOptions): Promise<void>;
    sendSignInLinkToEmail(email: string, options?: AuthEmailOptions): Promise<void>;
    signInWithEmailAndPassword(email: string, password: string): Promise<User>;
    signInWithPopup(provider: AuthProvider, options?: AuthProviderOptions): Promise<User>;
    signInWithRedirect(provider: AuthProvider, options?: AuthProviderOptions): Promise<void>;
    signInWithCredential(token: AuthCredential): Promise<User>;
    signInWithEmailLink(email: string): Promise<User>;
    signOut(): Promise<void>;
    updatePassword(password: string): Promise<void>;
    updateProfile(fields: AuthProfileFields): Promise<void>;
}

export default class AuthBase {
    database?: DatabaseBase;
    #UserData: AuthUserDataConstructor;

    constructor(options: AuthOptions = {}) {
        validateConstructorOptions(options);
        this.database = options.database;
        this.#UserData = options.UserData ?? DefaultUserData;
    }

    protected _createUserData = (data?: AuthUserDataJSON): UserData => {
        if (data !== undefined && (typeof data.id !== "string" || !data.id)) {
            fail("auth/invalid-user-data", "Auth user has no identifier.");
        }
        const user = new this.#UserData(this.database);
        return data === undefined ? user : user.fromJSON({
            ...data,
            role: data.role ?? null,
            private: data.private ?? {},
            requested: data.requested ?? Date.now(),
            loaded: data.loaded ?? {public: true, name: true, email: true, image: true}
        });
    };

    protected _requireCurrentUser<Identity>(user: Identity | null | undefined): Identity {
        if (!user) return fail("auth/no-current-user", "An authenticated user is required.");
        return user;
    }

    protected _requireDatabase(): DatabaseBase {
        if (!this.database) return fail("auth/database-required", "A database is required to save the user profile.");
        return this.database;
    }

    async checkSignInWithEmailLink(): Promise<boolean> {
        return notImplemented("checkSignInWithEmailLink");
    }

    createUserWithEmailAndPassword(email: string, password: string): void {
        validateString(email, "email");
        validateString(password, "password");
        this._requireDatabase();
    }

    onAuthStateChanged(callback: AuthStateCallback, onError?: AuthErrorCallback): void {
        validateCallbacks(callback, onError);
    }

    async resolveRedirectResult(): Promise<UserData | null> {
        return notImplemented("resolveRedirectResult");
    }

    resolveCurrentUser(options?: AuthCurrentUserOptions): void {
        validateCurrentUserOptions(options);
    }

    sendEmailVerification(options?: AuthEmailOptions): void {
        validateEmailOptions(options);
        this._requireDatabase();
    }

    sendPasswordResetEmail(email: string, options?: AuthEmailOptions): void {
        validateString(email, "email");
        validateEmailOptions(options);
    }

    sendSignInLinkToEmail(email: string, options?: AuthEmailOptions): void {
        validateString(email, "email");
        validateEmailOptions(options);
    }

    signInWithEmailAndPassword(email: string, password: string): void {
        validateString(email, "email");
        validateString(password, "password");
    }

    signInWithPopup(provider: AuthProvider, options?: AuthProviderOptions): void {
        validateProvider(provider, "provider");
        validateProviderOptions(options);
    }

    signInWithRedirect(provider: AuthProvider, options?: AuthProviderOptions): void {
        validateProvider(provider, "provider");
        validateProviderOptions(options);
    }

    signInWithCredential(token: AuthCredential): void {
        validateProvider(token, "credential");
    }

    signInWithEmailLink(email: string): void {
        validateString(email, "email");
    }

    async signOut(): Promise<void> {
        return notImplemented("signOut");
    }

    updatePassword(password: string): void {
        validateString(password, "password");
    }

    protected async _saveProfile(user: Pick<UserData, "id">, fields: AuthProfileFields): Promise<void> {
        if (!user?.id) fail("auth/no-current-user", "An authenticated user is required.");
        validateProfile(fields);
        if (fields.role !== undefined && fields.role !== "admin") {
            const database = this._requireDatabase();
            const role = await database.read(["roles", {user_id: user.id}]);
            if (role === "admin") {
                const roles = await database.read(["roles"], {equalTo: UserRole.ADMIN});
                let hasAnotherAdmin = false;
                for (const id of Object.keys(roles || {})) {
                    if (id === user.id) continue;
                    if (await database.read(["users_public", {user_id: id}]) != null) {
                        hasAnotherAdmin = true;
                        break;
                    }
                }
                DefaultUserData.assertAdminRemains(role, hasAnotherAdmin);
            }
        }
        await saveUserData(user, fields, this._requireDatabase());
    }

    _loadUserData(user: UserData): UserData | Promise<UserData> {
        return loadUserData(user, this.database, () => this._saveInitialProfile(user));
    }

    async _saveInitialProfile(user: UserData, fields: AuthProfileFields = {public: user.public, private: user.private}): Promise<void> {
        if (!user?.id) fail("auth/no-current-user", "An authenticated user is required.");
        validateProfile(fields);
        const database = this._requireDatabase();
        const options = {onError: (error: unknown) => { throw error; }};
        const permissionDenied = (error: unknown) => ["permission-denied", "database/permission-denied"]
            .includes(String((error as {code?: string})?.code).toLowerCase().replaceAll("_", "-"));
        let initialFields = fields;
        try {
            if (await database.read(["users_public", {user_id: user.id}], options) != null) return;
            if (fields.role === undefined) {
                const profiles = await database.cursor(["users_public", "user_id"], options)?.next(1);
                if (!profiles) fail("auth/profile-query-failed", "Cannot determine whether profiles exist.");
                if (!profiles.length) initialFields = {...fields, role: UserRole.ADMIN};
            }
        } catch (error) {
            if (!permissionDenied(error)) throw error;
            console.warn("[AuthBase] Initial ADMIN check denied; saving an ordinary profile.", (error as {code?: string}).code);
        }
        try {
            await saveUserData(user, initialFields, database, options);
        } catch (error) {
            if (initialFields === fields || !permissionDenied(error)) throw error;
            console.warn("[AuthBase] Initial ADMIN write denied; saving an ordinary profile.", (error as {code?: string}).code);
            initialFields = fields;
            await saveUserData(user, fields, database, options);
        }
        const state = user._getState?.();
        if (state) {
            if (initialFields.role !== undefined) state.role = initialFields.role;
            if (initialFields.public !== undefined) state.persisted = true;
        }
    }

    updateProfile(fields: AuthProfileFields): void {
        validateProfile(fields);
        this._requireDatabase();
    }
}
