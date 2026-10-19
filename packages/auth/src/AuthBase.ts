import {fail, notImplemented, UserData as DefaultUserData} from "../../common";
import type {UserData} from "../../common";
import type DatabaseBase from "../../database/src/common/DatabaseBase";
import type {DatabaseValue} from "../../database/src/common/DatabaseBase";
import saveUserData from "./common/saveUserData";
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

export default class AuthBase<User extends UserData = UserData> {
    database?: DatabaseBase;
    #UserData: AuthUserDataConstructor<User>;

    constructor(options: AuthOptions<User> = {}) {
        validateConstructorOptions(options);
        this.database = options.database;
        this.#UserData = options.UserData ?? DefaultUserData as AuthUserDataConstructor<User>;
    }

    protected _createUserData = (data?: AuthUserDataJSON): User => {
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

    onAuthStateChanged(callback: AuthStateCallback<User>, onError?: AuthErrorCallback): void {
        validateCallbacks(callback, onError);
    }

    async resolveRedirectResult(): Promise<User | null> {
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

    protected async _saveProfile(user: Pick<User, "id">, fields: AuthProfileFields): Promise<void> {
        if (!user?.id) fail("auth/no-current-user", "An authenticated user is required.");
        validateProfile(fields);
        await saveUserData(user, fields, this._requireDatabase());
    }

    updateProfile(fields: AuthProfileFields): void {
        validateProfile(fields);
        this._requireDatabase();
    }
}
