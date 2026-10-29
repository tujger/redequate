import type BackendBase from "../../../backend/src/common/BackendBase";
import type {DatabaseOrder} from "./DatabaseOrder";

/** A literal name or one string-valued field. */
export type DatabasePathSegment = string | {[key: string]: string};
/**
 * Reads require a non-empty path. Their trailing array string names an identity
 * field; concrete branches use named segments. Cursors may use '' or [] for root.
 */
export type DatabasePath = string | DatabasePathSegment[];
export type DatabaseValue = null | boolean | number | string | DatabaseValue[] | {[key: string]: DatabaseValue};
export type DatabaseQueryValue = null | boolean | number | string;
export type DatabaseErrorHandler = (error: unknown, reason: string, context: Record<string, unknown>) => void;

export interface DatabaseEntry {
    key: string;
    value: DatabaseValue;
}

/** Group heading: key is the configured group string. */
export interface DatabaseGroupEntry {
    key: string;
}

export interface DatabaseOptions extends Record<string, unknown> {
    backend?: BackendBase;
    onError?: DatabaseErrorHandler;
}

export interface DatabaseListenerOptions extends DatabaseOptions {
    onChange?: (value: DatabaseValue | undefined) => void;
    /** Only children whose keys sort strictly after the initial maximum key; no initial replay. */
    onChildAdd?: (entry: DatabaseEntry) => void;
    onChildChange?: (entry: DatabaseEntry) => void;
    onChildRemove?: (entry: DatabaseEntry) => void;
    orderBy?: DatabasePath;
}

export interface DatabaseReadOptions extends DatabaseOptions {
    equalTo?: DatabaseQueryValue;
    orderBy?: DatabasePath;
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
    /** Owning cursor ID; independent subscriptions of one cursor share it. */
    readonly id: string;
    readonly subscribed: Date;
    readonly active: boolean;
    readonly added: number;
    readonly changed: number;
    readonly removed: number;

    unsubscribe(): void;
}

/**
 * Shares read query fields. Cursor string starts without an end include the
 * matching prefix; equalTo excludes start/end but can accompany date bounds.
 */
export interface DatabaseCursorOptions extends DatabaseReadOptions {
    /** Headings count as entries, in addition to the requested page size. */
    group?: string;
    /** Inclusive date bounds: Firebase uses key time; Local uses an explicit timestamp field. */
    startDate?: Date;
    /** Includes the entire millisecond. */
    endDate?: Date;
    /**
     * Runs sequentially on deep copies. Undefined leaves storage and the read value
     * unchanged; null deletes; any other result replaces the value and is reread.
     * A record moved beyond the continuation can be handled again before composition deduplication.
     */
    handle?: (entry: DatabaseEntry) => DatabaseValue | void | Promise<DatabaseValue | void>;
}
