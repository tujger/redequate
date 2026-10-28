import type BackendClientBase from "../../../backend/src/BackendClientBase";
import {notImplemented} from "../../../common"
import DatabaseCursor from "./DatabaseCursor";
import createRecord from "./methods/create";
import updateRecord from "./methods/update";
import deleteRecord from "./methods/delete";
import type {
    DatabasePath, DatabaseValue, DatabaseOptions,
    DatabaseErrorHandler,
    DatabaseListenerOptions, DatabaseReadOptions, DatabaseCursorOptions
} from "./DatabaseTypes";

export {DatabaseCursor};
export {DatabaseOrder} from "./DatabaseOrder";
export type {
    DatabasePathSegment, DatabasePath, DatabaseValue, DatabaseEntry,
    DatabaseErrorHandler, DatabaseQueryValue,
    DatabaseGroupEntry, DatabaseCursorPosition, DatabaseCursorEvent,
    DatabaseOptions, DatabaseListenerOptions, DatabaseReadOptions,
    DatabaseCursorSubscription, DatabaseCursorOptions
} from "./DatabaseTypes";

type CreateMethodOptions = {
    key?: string;
    mapError?: (error: unknown) => unknown;
};

/**
 * onError may suppress a failure by returning normally; the operation then returns undefined.
 * Cursors and listeners retain their options. Writes resolve after storage confirms them.
 */
export default class DatabaseBase {
    onError: DatabaseErrorHandler;
    protected _backend?: BackendClientBase;

    constructor(
        {
            backend,
            onError = error => {
                throw error;
            }
        }: DatabaseOptions = {}) {
        this._backend = backend;
        this.onError = onError;
    }

    protected handleError(error: unknown, options: DatabaseOptions | undefined,
        reason: string, context: Record<string, unknown>): void {
        const onError = options?.onError ?? this.onError;
        onError(error, reason, context);
    }

    protected run<T>(operation: () => Promise<T>, options: DatabaseOptions | undefined,
                     reason: string, context: Record<string, unknown>): Promise<T | undefined>;

    protected run<T>(operation: () => T, options: DatabaseOptions | undefined,
                     reason: string, context: Record<string, unknown>): T | undefined;

    protected run<T>(operation: () => T | Promise<T>, options: DatabaseOptions | undefined,
        reason: string, context: Record<string, unknown>): T | Promise<T | undefined> | undefined {
        let result;
        try {
            result = operation();
            if (result && (result as Promise<T>).then instanceof Function) {
                return Promise.resolve(result).catch(error => {
                    this.handleError(error, options, reason, context);
                    return undefined;
                });
            }
        } catch (error) {
            this.handleError(error, options, reason, context);
            return undefined;
        }
        return result as T;
    }

    addEventListener(path: DatabasePath, options: DatabaseListenerOptions = {},
        subscribe: (callbacks: DatabaseListenerOptions) => {remove(): void} = () => notImplemented("addEventListener")): {remove(): void} | undefined {
        let callbackFailure: { error: unknown } | undefined;
        const report: DatabaseErrorHandler = (error, reason, context) => {
            try {
                this.handleError(error, options, reason, context);
            } catch (failure) {
                callbackFailure = {error: failure};
                throw failure;
            }
        };
        const callbackOptions = {
            onError: report
        };
        // A callback can run during registration. Do not report its failure twice.
        const registrationOptions: DatabaseOptions = {
            onError: (error, reason, context) => {
                if (callbackFailure && Object.is(callbackFailure.error, error)) {
                    throw error;
                }
                this.handleError(error, options, reason, context);
            }
        };
        return this.run(() => {
            const {onChange, onChildAdd, onChildChange, onChildRemove, orderBy} = options;
            const wrap = <T>(name: string, callback: ((value: T) => void) | undefined, argument: string) => {
                if (!(callback instanceof Function)) {
                    return callback;
                }
                return (value: T) => this.run(() => callback(value), callbackOptions,
                    `addEventListener.${name}`, {path, [argument]: value});
            };
            const listener = subscribe({
                onChange: wrap("onChange", onChange, "value"),
                onChildAdd: wrap("onChildAdd", onChildAdd, "entry"),
                onChildChange: wrap("onChildChange", onChildChange, "entry"),
                onChildRemove: wrap("onChildRemove", onChildRemove, "entry"),
                onError: error => report(error, "addEventListener", {path, orderBy}),
                orderBy
            });
            return {
                remove: () => this.run(() => listener.remove(), options,
                    "addEventListener.remove", {path})
            };
        }, registrationOptions, "addEventListener", {path});
    }

    /** Atomically creates an absent record and returns its permanent key. The callback receives that key synchronously before insertion. */
    async create(path: DatabasePath, valueOrCallback: DatabaseValue | ((key: string) => DatabaseValue), implementation?: CreateMethodOptions): Promise<string | undefined> {
        return createRecord(this._backend, path, valueOrCallback, implementation);
    }

    /**
     * Reads a non-empty path. The final string of an array names the collection
     * identity field (omitted from the Firebase address). Use named segments for
     * concrete records/fields, e.g. {email: "email"}; string paths stay literal.
     * Query options apply to children of the resolved address.
     */
    async read(path: DatabasePath, options: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        return notImplemented("read")
    }

    /**
     * Shallow merge: nested values are replaced; null deletes. Non-null values may create records.
     * Batch paths are root-relative. A synchronous callback replaces atomically,
     * returns the resulting value, deletes on null, and leaves storage unchanged on undefined.
     * The callback receives a copy; mutations without a returned value are discarded.
     */
    update(path: DatabasePath, callback: (value: DatabaseValue) => DatabaseValue | void, options?: DatabaseOptions): Promise<DatabaseValue | undefined>;
    update(path: DatabasePath, changes: Record<string, DatabaseValue>, options?: DatabaseOptions): Promise<void>;
    update(updates: Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>, options?: DatabaseOptions): Promise<void>;
    async update(path: DatabasePath | Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>, changes?: Record<string, DatabaseValue> | ((value: DatabaseValue) => DatabaseValue | void) | DatabaseOptions, options: DatabaseOptions = {}): Promise<DatabaseValue | void> {
        return updateRecord(this._backend, path, changes);
    }

    /** Absent records also succeed. */
    async delete(path: DatabasePath, options: DatabaseOptions = {}): Promise<void> {
        return deleteRecord(this._backend, path);
    }

    /**
     * Iterates immediate children. Arrays starting with a string are paths;
     * source lists compose fresh cursors round-robin, skipping null/undefined.
     * Compositions deduplicate by source path + key (or cursor ID + key without a path)
     * and run each source's handle once, before buffering.
     */
    cursor(path: DatabasePath | ((DatabaseCursorOptions & {path: DatabasePath}) | DatabaseCursor | null | undefined)[], options: DatabaseCursorOptions = {}): DatabaseCursor | undefined {
        return new DatabaseCursor(options, typeof path === "string" || (path instanceof Array &&
            (path.length === 0 || typeof path[0] === "string"))
            ? path as DatabasePath
            : undefined);
    }

    get TIMESTAMP(): DatabaseValue | undefined {
        return notImplemented("timestamp")
    }
}
