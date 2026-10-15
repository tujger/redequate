import {notImplemented} from '../../common/src/_packages'

/**
 * A path relative to the provider root. Array elements are joined with '/'
 * and may themselves contain nested paths. '' and [] identify the root.
 * Providers validate and normalize paths; this base class does neither.
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
    readonly temporaryKey: string;
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
    readonly index: number;
    readonly key: string | undefined;
    readonly finished: boolean;
}

export interface DatabaseCursorOptions extends DatabaseOptions {
    orderBy?: DatabasePath;
    equalTo?: DatabaseQueryValue;
    start?: DatabaseQueryValue;
    end?: DatabaseQueryValue;
    startDate?: Date;
    endDate?: Date;
    order?: "asc" | "desc";
    handle?: (entry: DatabaseEntry) => DatabaseValue | void | Promise<DatabaseValue | void>;
}

export interface DatabaseCursor {
    readonly position: DatabaseCursorPosition;
    next(n?: number): Promise<DatabaseEntry[] | undefined>;
    reset(): void;
}

export type DatabaseUpdates = Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>;

/**
 * Operation options.onError overrides the constructor's default handler.
 * Handlers receive the error, operation name and plain argument context.
 * By default errors are rethrown. If a handler returns normally, the operation
 * returns undefined; the handler's return value is ignored. Handler exceptions
 * propagate without being sent to the handler again. Handlers are synchronous.
     * Drafts, cursors and listeners retain the options chosen at their creation.
 */
export default class DatabaseBase {
    onError: DatabaseErrorHandler;

    constructor({onError = error => { throw error; }}: DatabaseOptions = {}) {
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

    addEventListener(path: DatabasePath, {
        onChange,
        onChildAdd,
        onChildChange,
        onChildRemove,
        onError,
        orderBy
    }: DatabaseListenerOptions): DatabaseListener | undefined {
        return notImplemented("addValueListener");
    }

    /**
     * Prepare record creation without writing to provider storage.
     * Returns a draft object synchronously with a constant readonly temporaryKey identifying
     * the prepared operation, not a guaranteed address in provider storage.
     * Calling draft.save(value) creates the record without overwriting an
     * existing record. Missing, undefined or null data and key conflicts reject by default.
     * The save method resolves to the permanent key after a successful storage write.
     * That key may differ from temporaryKey. Failed writes may be retried;
     * creating a record at an already occupied key rejects.
     */
    create(path: DatabasePath, options: DatabaseOptions = {}): DatabaseDraft | undefined {
        return notImplemented('create')
    }

    /**
     * Read a value as plain data, without provider references or snapshots.
     * Access and read failures reject by default; an absent record resolves to undefined.
     */
    async read(path: DatabasePath, {equalTo = undefined, orderBy = undefined}: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        return notImplemented('read')
    }

    /**
     * Update the supplied top-level fields, preserving unspecified fields.
     * Nested values are replaced in full; null removes a field.
     * An absent record does not cause rejection: non-null fields may create it.
     * Empty changes or removals alone need not create a record.
     * Resolves after the changes have been written to the provider's storage;
     * write failures reject by default.
     * The batch form writes values at multiple paths relative to the root.
     */
    update(path: DatabasePath, changes: DatabaseRecord, options?: DatabaseOptions): Promise<void>;
    update(updates: DatabaseUpdates, options?: DatabaseOptions): Promise<void>;
    async update(path: DatabasePath | DatabaseUpdates, changes?: DatabaseRecord | DatabaseOptions, options: DatabaseOptions = {}): Promise<void> {
        return notImplemented('update')
    }

    /**
     * Delete a record. Deleting an absent record also succeeds.
     * Resolves after deletion in the provider's storage; write failures reject by default.
     */
    async delete(path: DatabasePath, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('delete')
    }

    /**
     * Prepare a cursor starting before the first immediate collection element.
     * Initial position is {index: -1, key: undefined, finished: false}.
     * next defaults to one surviving element and resolves to an array on success.
     * Optional handle callbacks run sequentially on deep copies: undefined keeps
     * the read value, null deletes it, and any other result replaces it. Replaced
     * values are reread before returning. Deleted entries do not advance index.
     * Errors preserve progress through successful surviving entries, without
     * rolling back completed actions. Methods must be called sequentially,
     * outside handle. At the end, finished is true and next returns [].
     * reset restores the initial position.
     * orderBy selects a non-empty field path as a string or string[] joined with
     * slashes (default: key ordering). order defaults to asc.
     * start/end bound the ordered value inclusively (the key without orderBy).
     * A string start without end implies end = start + "\uf8ff" for prefix matching.
     * equalTo is exact and excludes start/end, but can be combined with dates.
     * startDate/endDate bound record keys inclusively using the minimum/maximum
     * timestamp-based key for each millisecond. With orderBy, dates filter the
     * scan before handle; excluded rows do not advance index and next fills n
     * matching survivors when available. Such filtering can require extra reads.
     * Position index is relative to the selection. Missing sort fields are null;
     * object-valued sort fields cannot be used as continuation boundaries.
     * There is no traversal-wide snapshot; changing sort fields can cause repeats
     * or omissions. reset preserves selection options.
     */
    cursor(path: DatabasePath, options: DatabaseCursorOptions = {}): DatabaseCursor | undefined {
        return notImplemented('cursor')
    }

    /**
     * Create or fully replace the value at an exact path, including nested values.
     * A null value deletes the data at that path; undefined or missing values reject.
     * Resolves after a successful provider storage write. Storage failures reject by default.
     */
    async write(path: DatabasePath, value: DatabaseValue, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('write')
    }

    get TIMESTAMP(): DatabaseValue | undefined {
        return notImplemented('timestamp')
    }

    increment(delta: number, options: DatabaseOptions = {}): DatabaseValue | undefined {
        return notImplemented('increment')
    }
}
