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
     * Iterate over a collection's immediate records using for await...of.
     * An empty collection yields nothing. Early termination, including break,
     * releases provider resources. No common ordering or consistent snapshot
     * across the traversal is guaranteed. Failures reject the next() operation.
     */
    async* iterate(path: DatabasePath): AsyncIterableIterator<DatabaseEntry> {
        yield notImplemented('iterate')
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
