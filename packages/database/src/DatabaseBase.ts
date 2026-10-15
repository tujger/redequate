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
    save(value: DatabaseRecord): Promise<string>;
}

export interface DatabaseListener {
    remove(): void;
}

export interface DatabaseListenerOptions {
    onChange?: (value: DatabaseValue | undefined) => void;
    onChildAdd?: (entry: DatabaseEntry) => void;
    onChildChange?: (entry: DatabaseEntry) => void;
    onChildRemove?: (entry: DatabaseEntry) => void;
    onError?: (error: Error) => void;
    orderBy?: string;
}

export interface DatabaseReadOptions {
    equalTo?: null | boolean | number | string;
    orderBy?: string;
}

export interface DatabaseCursorPosition {
    readonly index: number;
    readonly key: string | undefined;
    readonly finished: boolean;
}

export interface DatabaseCursorOptions extends Record<string, unknown> {
    handle?: (entry: DatabaseEntry) => DatabaseValue | void | Promise<DatabaseValue | void>;
}

export interface DatabaseCursor {
    readonly position: DatabaseCursorPosition;
    next(n?: number): Promise<DatabaseEntry[]>;
    reset(): void;
}

export type DatabaseOptions = Record<string, unknown>;
export type DatabaseUpdates = Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>;

export default class DatabaseBase {
    addEventListener(path: DatabasePath, {
        onChange,
        onChildAdd,
        onChildChange,
        onChildRemove,
        onError,
        orderBy
    }: DatabaseListenerOptions): DatabaseListener {
        return notImplemented("addValueListener");
    }

    /**
     * Prepare record creation without writing to provider storage.
     * Returns a draft object synchronously with a constant readonly temporaryKey identifying
     * the prepared operation, not a guaranteed address in provider storage.
     * Calling draft.save(value) creates the record without overwriting an
     * existing record. Missing, undefined or null data and key conflicts reject.
     * The save method resolves to the permanent key after a successful storage write.
     * That key may differ from temporaryKey. Failed writes may be retried;
     * creating a record at an already occupied key rejects.
     */
    create(path: DatabasePath): DatabaseDraft {
        return notImplemented('create')
    }

    /**
     * Read a value as plain data, without provider references or snapshots.
     * Access and read failures reject; an absent record resolves to undefined.
     */
    async read(path: DatabasePath, {equalTo = undefined, orderBy = undefined}: DatabaseReadOptions = {}): Promise<DatabaseValue | undefined> {
        return notImplemented('read')
    }

    /**
     * Update an existing record's top-level fields. Nested values are replaced
     * in full; null removes a field. An absent record rejects, without creating it.
     * Resolves after the changes have been written to the provider's storage.
     * The batch form writes values at multiple paths relative to the root.
     */
    update(path: DatabasePath, changes: DatabaseRecord, options?: DatabaseOptions): Promise<void>;
    update(updates: DatabaseUpdates): Promise<void>;
    async update(path: DatabasePath | DatabaseUpdates, changes?: DatabaseRecord, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('update')
    }

    /**
     * Delete a record. Deleting an absent record also succeeds.
     * Resolves after deletion in the provider's storage; write failures reject.
     */
    async delete(path: DatabasePath, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('delete')
    }

    /**
     * Prepare a cursor starting before the first immediate collection element.
     * Initial position is {index: -1, key: undefined, finished: false}.
     * next defaults to one surviving element and always resolves to an array.
     * Optional handle callbacks run sequentially on deep copies: undefined keeps
     * the read value, null deletes it, and any other result replaces it. Replaced
     * values are reread before returning. Deleted entries do not advance index.
     * Errors preserve progress through successful surviving entries, without
     * rolling back completed actions. Methods must be called sequentially,
     * outside handle. At the end, finished is true and next returns [].
     * reset restores the initial position.
     */
    cursor(path: DatabasePath, options: DatabaseCursorOptions = {}): DatabaseCursor {
        return notImplemented('cursor')
    }

    /**
     * Create or fully replace the value at an exact path, including nested values.
     * A null value deletes the data at that path; undefined or missing values reject.
     * Resolves after a successful provider storage write. Storage failures reject.
     */
    async write(path: DatabasePath, value: DatabaseValue, {}: DatabaseOptions = {}): Promise<void> {
        return notImplemented('write')
    }

    get TIMESTAMP(): DatabaseValue {
        return notImplemented('timestamp')
    }

    increment(delta: number): DatabaseValue {
        return notImplemented('increment')
    }
}
