import normalizePath from "./normalizePath";
import {DatabaseOrder} from "./DatabaseOrder";
import {fail, identifier} from "../../../common";
import type {
    DatabaseCursorEntry, DatabaseCursorGroupEntry, DatabaseCursorEvent,
    DatabaseCursorPosition, DatabaseCursorSubscription, DatabaseCursorOptions, DatabasePath
} from "./DatabaseBase";

/** Base for cursors consumed sequentially, exclusively by their owner or composition. */
export class DatabaseCursor {
    readonly #id: string;
    readonly #options: Readonly<DatabaseCursorOptions>;
    readonly #path?: string;
    #headingReturned = false;
    protected _count = 0;
    protected _position: DatabaseCursorPosition = Object.freeze({index: -1, key: undefined, finished: false});

    constructor(options: DatabaseCursorOptions & {id?: string} = {}, path?: DatabasePath) {
        if (options === null || typeof options !== "object" || options instanceof Array) {
            fail("database/invalid-argument", "options must be an object.");
        }
        const {id = identifier(), group, order = DatabaseOrder.ASC, handle} = options;
        if (group !== undefined && typeof group !== "string") {
            fail("database/invalid-argument", "group must be a string.");
        }
        if (order !== DatabaseOrder.ASC && order !== DatabaseOrder.DESC) {
            fail("database/invalid-argument", "order must be asc or desc.");
        }
        if (handle !== undefined && !(handle instanceof Function)) {
            fail("database/invalid-argument", "handle must be a function or undefined.");
        }
        this.#id = id;
        const {orderBy, equalTo, start, end} = options;
        if (orderBy !== undefined && !(typeof orderBy === "string" && normalizePath(orderBy)
            || orderBy instanceof Array && orderBy.length && orderBy.every(part => typeof part === "string")
                && normalizePath(orderBy))) {
            fail("database/invalid-argument", "orderBy must be a non-empty field path.");
        }
        if (equalTo !== undefined && (start !== undefined || end !== undefined)) {
            fail("database/invalid-argument", "equalTo cannot be combined with start or end.");
        }
        for (const value of [equalTo, start, end]) {
            if (value !== undefined && value !== null && typeof value !== "boolean" && typeof value !== "string"
                && !(typeof value === "number" && Number.isFinite(value))) {
                fail("database/invalid-argument", "Query bounds must be null, booleans, finite numbers or strings.");
            }
        }
        this.#options = Object.freeze({...options, order,
            orderBy: orderBy instanceof Array ? [...orderBy] : orderBy});
        this.#path = path === undefined ? undefined : normalizePath(path);
    }

    get id(): string { return this.#id; }
    get path(): string | undefined { return this.#path; }
    get group(): string | undefined { return this.#options.group; }
    get order(): DatabaseOrder { return this.#options.order!; }
    get orderBy(): DatabasePath | undefined { return this.#options.orderBy; }
    get start() { return this.#options.start; }
    get end() { return this.#options.end; }
    get equalTo() { return this.#options.equalTo; }
    get startDate() { return this.#options.startDate; }
    get endDate() { return this.#options.endDate; }
    get handle() { return this.#options.handle; }
    get onError() { return this.#options.onError; }
    /** Returned entries plus delivered adds minus removes; repeated deliveries count again. */
    get count(): number { return this._count; }
    get position(): DatabaseCursorPosition { return this._position; }

    /** Group headings are additional; grouped compositions return whole source blocks. */
    async next(n = 1): Promise<(DatabaseCursorEntry | DatabaseCursorGroupEntry)[] | undefined> {
        if (!Number.isSafeInteger(n) || n <= 0) {
            fail("database/invalid-argument", "n must be a positive safe integer.");
        }
        if (this.group === undefined || this.#headingReturned || this._position.finished) return [];
        this.#headingReturned = true;
        const heading = {key: this.path ?? this.id, value: {group: this.group}};
        this._count++;
        this._position = Object.freeze({...this._position, index: this._position.index + 1, key: heading.key});
        return [heading];
    }

    /** Subscribe without initial entries; each call owns an independent subscription. */
    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        if (!(listener instanceof Function)) {
            fail("database/invalid-argument", "listener must be a function.");
        }
        return undefined;
    }
}
