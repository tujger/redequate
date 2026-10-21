import {notImplemented} from '../../../common'
import {DatabaseCursor} from "./DatabaseCursor";
import type {
    DatabasePath, DatabaseCreatePath, DatabaseValue, DatabaseRecord, DatabaseDraft,
    DatabaseListener, DatabaseErrorContext, DatabaseErrorHandler, DatabaseOptions,
    DatabaseListenerOptions, DatabaseReadOptions, DatabaseCursorOptions, DatabaseCursorSource,
    DatabaseUpdates, DatabaseUpdater
} from "./DatabaseTypes";

export {DatabaseCursor};
export {DatabaseOrder} from "./DatabaseOrder";
export type {
    DatabaseNamedPathSegment, DatabasePathSegment, DatabasePath, DatabaseCreatePath, DatabaseFieldPath,
    DatabaseValue, DatabaseRecord, DatabaseEntry, DatabaseGroupEntry,
    DatabaseDraft, DatabaseListener, DatabaseErrorContext, DatabaseErrorHandler,
    DatabaseOptions, DatabaseListenerOptions, DatabaseQueryValue, DatabaseReadOptions,
    DatabaseCursorPosition, DatabaseCursorEvent, DatabaseCursorSubscription, DatabaseCursorOptions,
    DatabaseCursorSource, DatabaseUpdates, DatabaseUpdater
} from "./DatabaseTypes";

/**
 * onError may suppress a failure by returning normally; the operation then returns undefined.
 * Drafts, cursors and listeners retain their options. Writes resolve after storage confirms them.
 */
export default class DatabaseBase {
    onError: DatabaseErrorHandler;

    constructor(
        {
            onError = error => {
                throw error;
            }
        }: DatabaseOptions = {}) {
        this.onError = onError;
    }

    protected handleError(error: unknown, options: DatabaseOptions | undefined,
                          reason: string, context: DatabaseErrorContext): void {
        const onError = options?.onError ?? this.onError;
        onError(error, reason, context);
    }

    protected run<T>(operation: () => Promise<T>, options: DatabaseOptions | undefined,
                     reason: string, context: DatabaseErrorContext): Promise<T | undefined>;

    protected run<T>(operation: () => T, options: DatabaseOptions | undefined,
                     reason: string, context: DatabaseErrorContext): T | undefined;

    protected run<T>(operation: () => T | Promise<T>, options: DatabaseOptions | undefined,
                     reason: string, context: DatabaseErrorContext): T | Promise<T | undefined> | undefined {
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
                     subscribe: (callbacks: DatabaseListenerOptions) => DatabaseListener = () => notImplemented("addEventListener")): DatabaseListener | undefined {
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

    /** Last segment names the generated key field or supplies its ID. No write until draft.save(). */
    create(path: DatabaseCreatePath, options: DatabaseOptions = {}): DatabaseDraft | undefined {
        return notImplemented('create')
    }

    /** Reads the exact non-empty path; query options apply to its immediate children. */
    async read(path: DatabasePath, options: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        return notImplemented('read')
    }

    /**
     * Shallow merge: nested values are replaced; null deletes. Non-null values may create records.
     * Batch paths are root-relative. A synchronous callback replaces atomically,
     * returns the final value, and deletes on null or undefined; it requires read/write access.
     */
    update(path: DatabasePath, callback: DatabaseUpdater, options?: DatabaseOptions): Promise<DatabaseValue | undefined>;
    update(path: DatabasePath, changes: DatabaseRecord, options?: DatabaseOptions): Promise<void>;
    update(updates: DatabaseUpdates, options?: DatabaseOptions): Promise<void>;
    async update(path: DatabasePath | DatabaseUpdates, changes?: DatabaseRecord | DatabaseUpdater | DatabaseOptions, options: DatabaseOptions = {}): Promise<DatabaseValue | void> {
        return notImplemented('update')
    }

    /** Absent records also succeed. */
    async delete(path: DatabasePath, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('delete')
    }

    /**
     * Iterates immediate children. Arrays starting with a string are paths;
     * source lists compose fresh cursors round-robin, skipping null/undefined.
     * Compositions deduplicate by source path + key (or cursor ID + key without a path)
     * and run each source's handle once, before buffering.
     */
    cursor(path: DatabasePath | (DatabaseCursorSource | DatabaseCursor | null | undefined)[], options: DatabaseCursorOptions = {}): DatabaseCursor {
        return new DatabaseCursor(options, typeof path === "string" || path instanceof Array
            && (path.length === 0 || typeof path[0] === "string") ? path as DatabasePath : undefined);
    }

    get TIMESTAMP(): DatabaseValue | undefined {
        return notImplemented('timestamp')
    }

    increment(delta: number): DatabaseValue | undefined {
        return notImplemented('increment')
    }
}
