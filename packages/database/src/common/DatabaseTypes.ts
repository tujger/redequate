import type {DatabaseOrder} from "./DatabaseOrder";

/**
 * One string-valued field per named segment. Local dynamic level _ accepts a
 * non-negative integer; true means 0. Firebase ignores _.
 */
export type DatabaseNamedPathSegment = {
    [key: string]: string | number | true | undefined;
    _?: number | true;
};
export type DatabasePathSegment = string | DatabaseNamedPathSegment;
/** Reads require a non-empty path; cursors may use '' or [] for root. */
export type DatabasePath = string | DatabasePathSegment[];
/** Parent collection path followed by the generated key's field name. */
export type DatabaseCreatePath = [DatabasePathSegment, ...(DatabasePathSegment)[], string | DatabaseNamedPathSegment];
/** '' and [] select the whole value. */
export type DatabaseFieldPath = DatabasePath;

export type DatabaseValue = null | boolean | number | string | DatabaseValue[] | DatabaseRecord;

export interface DatabaseRecord {
    [key: string]: DatabaseValue;
}

export interface DatabaseEntry {
    key: string;
    value: DatabaseValue;
}

/** Group heading: key is the configured group string. */
export interface DatabaseGroupEntry {
    key: string;
}

export interface DatabaseDraft {
    /** Final key: a Firebase-compatible push key unless the caller supplied one. */
    readonly temporaryKey: string;

    /** Saves only if the key is absent. The callback receives the final key synchronously. No timestamp field is added. */
    save(value: DatabaseRecord | ((key: string) => DatabaseRecord)): Promise<string | undefined>;
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
    /** Only children whose keys sort strictly after the initial maximum key; no initial replay. */
    onChildAdd?: (entry: DatabaseEntry) => void;
    onChildChange?: (entry: DatabaseEntry) => void;
    onChildRemove?: (entry: DatabaseEntry) => void;
    orderBy?: DatabaseFieldPath;
}

export type DatabaseQueryValue = null | boolean | number | string;

export interface DatabaseReadOptions extends DatabaseOptions {
    equalTo?: DatabaseQueryValue;
    orderBy?: DatabaseFieldPath;
    /** Defaults to ascending order. */
    order?: DatabaseOrder;
    /** Inclusive query bounds. */
    start?: DatabaseQueryValue;
    end?: DatabaseQueryValue;
}

/** Initial position: index -1, key undefined, finished false. */
export interface DatabaseCursorPosition {
    readonly index: number;
    readonly key: string | undefined;
    readonly finished: boolean;
}

export interface DatabaseCursorEvent {
    type: "add" | "change" | "remove";
    entry: DatabaseEntry;
}

export interface DatabaseCursorSubscription {
    readonly id: string;
    readonly subscribed: Date;
    readonly active: boolean;
    readonly added: number;
    readonly changed: number;
    readonly removed: number;

    unsubscribe(): void;
}

export interface DatabaseCursorOptions extends DatabaseOptions {
    /** Headings count as entries, in addition to the requested page size. */
    group?: string;
    /** Defaults to value order with equalTo, key order otherwise. Missing or null ordered fields are skipped. */
    orderBy?: DatabaseFieldPath;
    /** Exact match; excludes start/end, but allows date bounds. */
    equalTo?: DatabaseQueryValue;
    /** Bounds are inclusive; a string without end implies end = start + "\uf8ff". */
    start?: DatabaseQueryValue;
    end?: DatabaseQueryValue;
    /** Inclusive timestamp-key bounds, applied before handle. */
    startDate?: Date;
    /** Includes the entire millisecond. */
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

/** Synchronous replacement; null or undefined deletes. May run repeatedly. */
export type DatabaseUpdater = (value: DatabaseValue) => DatabaseValue | undefined;

export type DatabaseUpdates = Map<DatabasePath, DatabaseValue> | Record<string, DatabaseValue>;
