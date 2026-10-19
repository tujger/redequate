import {DatabaseOrder} from "./DatabaseOrder";
import {identifier, notImplemented} from "../../../common";
import type {
    DatabaseCursorEntry, DatabaseCursorGroupEntry, DatabaseCursorEvent,
    DatabaseCursorPosition, DatabaseCursorSubscription
} from "./DatabaseBase";

/** Base for cursors consumed sequentially, exclusively by their owner or composition. */
export class DatabaseCursor {
    private readonly _id: string;
    private readonly _group?: string;
    private readonly _order: DatabaseOrder;
    protected _count = 0;
    protected _position: DatabaseCursorPosition = Object.freeze({index: -1, key: undefined, finished: false});

    constructor({id = identifier(), group, order = DatabaseOrder.ASC}: {
        id?: string; group?: string; order?: DatabaseOrder;
    } = {}) {
        this._id = id;
        this._group = group;
        this._order = order;
    }

    get id(): string { return this._id; }
    get group(): string | undefined { return this._group; }
    get order(): DatabaseOrder { return this._order; }
    /** Returned entries plus delivered adds minus removes; repeated deliveries count again. */
    get count(): number { return this._count; }
    get position(): DatabaseCursorPosition { return this._position; }

    /** Group headings are additional; grouped compositions return whole source blocks. */
    async next(n = 1): Promise<(DatabaseCursorEntry | DatabaseCursorGroupEntry)[] | undefined> {
        return notImplemented("next");
    }

    /** Subscribe without initial entries; each call owns an independent subscription. */
    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        return notImplemented("subscribe");
    }
}
