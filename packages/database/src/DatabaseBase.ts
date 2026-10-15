import {identifier, notImplemented} from '../../common/src/_packages'

/**
 * Provider-relative path; array parts are joined with '/'. '' and [] mean root.
 */
export type DatabasePath = string | string[];

export type DatabaseValue = null | boolean | number | string | DatabaseValue[] | DatabaseRecord;

export interface DatabaseRecord {
    [key: string]: DatabaseValue;
}

export interface DatabaseEntry {
    key: string;
    value: DatabaseValue;
}

export interface DatabaseDraft {
    /** Identifies the draft; may differ from the permanent key. */
    readonly temporaryKey: string;

    /** Create without overwriting and return the permanent key. Null/undefined reject; failures allow retry. */
    save(value: DatabaseRecord): Promise<string | undefined>;
}

export interface DatabaseListener {
    remove(): void;
}

export type DatabaseErrorContext = Record<string, unknown>;
export type DatabaseErrorHandler = (error: unknown, reason: string, context: DatabaseErrorContext) => void;

export interface DatabaseOptions extends Record<string, unknown> {
    onError?: DatabaseErrorHandler;
}

export interface DatabaseListenerOptions extends DatabaseOptions {
    onChange?: (value: DatabaseValue | undefined) => void;
    onChildAdd?: (entry: DatabaseEntry) => void;
    onChildChange?: (entry: DatabaseEntry) => void;
    onChildRemove?: (entry: DatabaseEntry) => void;
    orderBy?: string;
}

export type DatabaseQueryValue = null | boolean | number | string;

export interface DatabaseReadOptions extends DatabaseOptions {
    equalTo?: DatabaseQueryValue;
    orderBy?: string;
}

export interface DatabaseCursorPosition {
    /** Last returned entry's index within the selection; initially -1. */
    readonly index: number;
    /** Last returned key; initially undefined. */
    readonly key: string | undefined;
    /** All sources and buffered entries are exhausted; initially false. */
    readonly finished: boolean;
}

export enum DatabaseOrder {
    ASC = "asc",
    DESC = "desc"
}

export interface DatabaseCursorOptions extends DatabaseOptions {
    /** Field path. If omitted, order by value when equalTo is defined, otherwise by key. */
    orderBy?: DatabasePath;
    /** Exact match; excludes start/end, but allows date bounds. */
    equalTo?: DatabaseQueryValue;
    /** Inclusive ordered-value bound; a string without end implies end = start + "\uf8ff". */
    start?: DatabaseQueryValue;
    /** Inclusive ordered-value bound. */
    end?: DatabaseQueryValue;
    /** Inclusive minimum timestamp key; date filtering precedes handle. */
    startDate?: Date;
    /** Inclusive maximum timestamp key, including the entire millisecond. */
    endDate?: Date;
    /** Defaults to asc. */
    order?: DatabaseOrder;
    /**
     * Runs sequentially on deep copies. Undefined leaves storage and the read value
     * unchanged; null deletes; any other result replaces the value and is reread.
     */
    handle?: (entry: DatabaseEntry) => DatabaseValue | void | Promise<DatabaseValue | void>;
}

/** Source options override outer options; explicit undefined clears an inherited option. */
export interface DatabaseCursorSource extends DatabaseCursorOptions {
    path: DatabasePath;
}

/** Call methods sequentially, outside handle. Concurrent data changes may cause repeats or omissions. */
export interface DatabaseCursor {
    /** Unique to this cursor instance; unchanged by reset. */
    readonly identifier: string;
    readonly position: DatabaseCursorPosition;

    /**
     * Return up to n surviving entries (default 1), or [] when finished.
     * Filtered/deleted entries do not advance index. Reads are buffered until consumed.
     * Errors preserve completed actions and progress; the failed entry can be retried.
     */
    next(n?: number): Promise<DatabaseEntry[] | undefined>;

    /** Restore initial position and clear buffers/deduplication, preserving options. */
    reset(): void;
}

export type DatabaseUpdates = Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>;

/**
 * Errors throw/reject by default. Per-operation onError overrides the default
 * and synchronously receives (error, operation name, argument context).
 * Returning normally suppresses the error with an undefined result; handler
 * exceptions propagate once. Drafts, cursors and listeners retain their options.
 * Write promises resolve after storage confirms the operation.
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
            if (result && typeof (result as Promise<T>).then === "function") {
                return Promise.resolve(result).catch(error => {
                    this.handleError(error, options, reason, context);
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
                if (typeof callback !== "function") {
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

    /**
     * Prepare creation with an automatic key, without writing. Call draft.save to persist.
     */
    create(path: DatabasePath, options: DatabaseOptions = {}): DatabaseDraft | undefined {
        return notImplemented('create')
    }

    /**
     * Read plain data; absent records resolve to undefined.
     */
    async read(path: DatabasePath, {
        equalTo = undefined,
        orderBy = undefined
    }: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        return notImplemented('read')
    }

    /**
     * Merge top-level fields; nested values are replaced, null removes a field.
     * Non-null fields may create an absent record; empty changes/removals need not.
     * The batch form writes values at paths relative to the root.
     */
    update(path: DatabasePath, changes: DatabaseRecord, options?: DatabaseOptions): Promise<void>;
    update(updates: DatabaseUpdates, options?: DatabaseOptions): Promise<void>;
    async update(path: DatabasePath | DatabaseUpdates, changes?: DatabaseRecord | DatabaseOptions, options: DatabaseOptions = {}): Promise<void> {
        return notImplemented('update')
    }

    /**
     * Delete a record; absent records also succeed.
     */
    async delete(path: DatabasePath, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('delete')
    }

    /**
     * Create a cursor over immediate children, initially before the first entry.
     * A non-empty source-object array composes cursors in round-robin order;
     * string arrays remain paths. Nested compositions are unsupported.
     * Composition deduplicates by normalized path + key before handle, including
     * deletions, until reset. Each source uses its own effective onError.
     */
    cursor(path: DatabasePath | DatabaseCursorSource[], options: DatabaseCursorOptions = {}): Pick<DatabaseCursor, "identifier"> {
        return Object.freeze({identifier: identifier()});
    }

    /**
     * Create or fully replace an exact path. Null deletes; undefined/missing values reject.
     */
    async write(path: DatabasePath, value: DatabaseValue, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('write')
    }

    get TIMESTAMP(): DatabaseValue | undefined {
        return notImplemented('timestamp')
    }

    increment(delta: number): DatabaseValue | undefined {
        return notImplemented('increment')
    }
}
