import validatePath from "./helpers/validatePath";
import {DatabaseOrder} from "./DatabaseOrder";
import {fail, identifier} from "../../../common";
import type BackendBase from "../../../backend/src/common/BackendBase";
import type DatabaseBase from "./DatabaseBase";
import parseFirebasePath from "../firebase/helpers/parsePath";
import parseLocalPath from "../local/helpers/parsePath";
import {getChildRecordPath} from "../local/helpers/records";
import {hasIntermediateWildcard} from "./helpers/cursorPath";
import type {
    DatabaseEntry, DatabaseGroupEntry, DatabaseCursorEvent, DatabaseCursorPosition,
    DatabaseCursorSubscription, DatabaseCursorOptions, DatabasePath, DatabaseValue, CursorStatus
} from "./DatabaseTypes";

/** Base for cursors consumed sequentially, exclusively by their owner or composition. */
export default class DatabaseCursor {
    readonly #id: string;
    readonly #options: Readonly<DatabaseCursorOptions>;
    readonly #path?: DatabasePath;
    protected readonly _database?: DatabaseBase;
    protected readonly _backend?: BackendBase;
    protected _started = false;
    protected _heading?: DatabaseGroupEntry;

    protected _count = 0;
    protected _position: DatabaseCursorPosition = Object.freeze({index: -1, key: undefined, finished: false});

    constructor(
        path?: DatabasePath,
        options: DatabaseCursorOptions & { id?: string } = {},
        {backend, database}: { backend?: BackendBase; database?: DatabaseBase } = {}
    ) {
        if (options === null || typeof options !== "object" || options instanceof Array) {
            fail("database/invalid-argument", "options must be an object.");
        }
        const {id = identifier(), ...cursorOptions} = options;
        const {group, order = DatabaseOrder.ASC, handle} = cursorOptions;
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
        if (path !== undefined) {
            validatePath(path);
        }
        if (orderBy !== undefined) {
            validatePath(orderBy);
        }
        if (equalTo !== undefined && (start !== undefined || end !== undefined)) {
            fail("database/invalid-argument", "equalTo cannot be combined with start or end.");
        }
        for (const value of [equalTo, start, end]) {
            if (value === undefined || value === null || typeof value === "boolean" || typeof value === "string") {
                continue;
            }
            if (typeof value === "number" && Number.isFinite(value)) {
                continue;
            }
            fail("database/invalid-argument", "Query bounds must be null, booleans, finite numbers or strings.");
        }
        this.#options = Object.freeze({
            ...cursorOptions,
            order,
            orderBy: orderBy instanceof Array ? [...orderBy] : orderBy
        });
        this.#path = path instanceof Array ? [...path] : path;
        this._backend = backend;
        this._database = database;
    }

    get id(): string {
        return this.#id;
    }

    get path(): DatabasePath | undefined {
        if (this.#path === undefined || !this._database || hasIntermediateWildcard(this.#path)) {
            return this.#path;
        }
        if ("storageId" in this._database) {
            return parseLocalPath(this.#path, "collection").effectivePath;
        }
        return parseFirebasePath(this.#path, "collection").address;
    }

    get group(): string | undefined {
        return this.#options.group;
    }

    get order(): DatabaseOrder {
        return this.#options.order!;
    }

    get orderBy(): DatabasePath | undefined {
        return this.#options.orderBy;
    }

    get start() {
        return this.#options.start;
    }

    get end() {
        return this.#options.end;
    }

    get equalTo() {
        return this.#options.equalTo;
    }

    get startDate() {
        return this.#options.startDate;
    }

    get endDate() {
        return this.#options.endDate;
    }

    get handle() {
        return this.#options.handle;
    }

    get onError() {
        return this.#options.onError;
    }

    /** Returned entries plus delivered adds minus removes; repeated deliveries count again. */
    get count(): number {
        return this._count;
    }

    get position(): DatabaseCursorPosition {
        return this._position;
    }

    /** Validate and supply the initial heading; subclasses account for their complete result. */
    async next(
        n = 1,
        handle?: DatabaseCursorOptions["handle"] | null
    ): Promise<(DatabaseEntry | DatabaseGroupEntry)[] | undefined> {
        if (!Number.isSafeInteger(n) || n <= 0) {
            fail("database/invalid-argument", "n must be a positive safe integer.");
        }
        if (handle !== undefined && handle !== null && !(handle instanceof Function)) {
            fail("database/invalid-argument", "handle must be a function, null or undefined.");
        }
        this._started = true;
        if (this.group === undefined || this._heading || this._position.finished) {
            return [];
        }
        const heading = {key: this.group};
        this._heading = heading;
        return [heading];
    }

    /** Subscribe without initial entries; each call owns an independent subscription. */
    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        if (!(listener instanceof Function)) {
            fail("database/invalid-argument", "listener must be a function.");
        }
        return undefined;
    }

    async status(): Promise<CursorStatus> {
        if (!this._backend) {
            fail("database/invalid-argument", "Cursor status requires a backend.");
        }
        const value = await this._backend.request("database.read", this.#statusPath()) as CursorStatus | null;
        if (!value) {
            return {
                checkpoint: null,
                count: 0,
                finishedAt: null,
                startedAt: null,
                state: "ready",
                updatedAt: null,
                userId: null,
            };
        }
        const {userId, checkpoint, count, startedAt, updatedAt, finishedAt, state, error} = value;
        return {
            checkpoint: checkpoint ? {...checkpoint, key: checkpoint.key ?? undefined} : null,
            count,
            ...(error ? {error} : {}),
            finishedAt,
            startedAt,
            state,
            updatedAt,
            userId: userId ?? null,
        };
    }

    async all(size = 1, checkpoint?: DatabaseCursorPosition | null): Promise<number> {
        validateAllArguments(size, checkpoint);
        const readOnly = this._allReadOnly;
        if (!readOnly && !this._backend) {
            fail("database/invalid-argument", "Cursor pages require a path and backend.");
        } else if (this.#path === undefined) {
            fail("database/invalid-argument", "Cursor pages require a path and backend.");
        }
        const previous = readOnly ? {checkpoint: null, count: 0, startedAt: null} : await this.status();
        const {start, resumed} = this.#resolveAllStart(checkpoint, previous.checkpoint);
        const startedAt = resumed ? previous.startedAt ?? Date.now() : Date.now();
        let count = resumed ? previous.count : 0;
        let saved = start;
        let committed = previous.checkpoint;
        let checkpointChanged = false;
        if (this.position.finished || this.position.index > (start?.index ?? -1)) {
            fail("database/invalid-argument", "Current cursor is past the requested checkpoint.");
        }
        const userId = readOnly ? null : (await this._backend!.getCurrentUser()) ?? null;
        try {
            await this.#restorePosition(start);
            while (true) {
                const {count: pageCount, changes} = await this.#readAllPage(size, readOnly);
                const position = this.position;
                const nextCount = count + pageCount;
                if (!readOnly) {
                    const current = await this.status();
                    if (JSON.stringify(current.checkpoint) !== JSON.stringify(committed)) {
                        checkpointChanged = true;
                        fail("database/invalid-argument", "Cursor checkpoint changed during page processing.");
                    }
                    await this.#writeAllPage(changes, position, nextCount, startedAt, userId);
                }
                count = nextCount;
                saved = position;
                committed = position;
                if (position.finished) return count;
            }
        } catch (error) {
            if (!readOnly && !checkpointChanged) {
                await this.#writeAllFailure(error, saved, count, startedAt, userId);
            }
            throw error;
        }
    }

    protected get _allReadOnly(): boolean {
        return false;
    }

    protected static _assertFresh(cursor: DatabaseCursor): void {
        if (cursor._started) {
            fail("database/invalid-argument", "Composition requires fresh cursors used exclusively by the composition.");
        }
    }

    #statusPath(): DatabasePath {
        return ["meta", {setting: `cursor:${this.id}`}];
    }

    #resolveAllStart(
        checkpoint: DatabaseCursorPosition | null | undefined,
        previous: DatabaseCursorPosition | null
    ): { start: DatabaseCursorPosition | null | undefined; resumed: boolean } {
        let start = checkpoint;
        if (checkpoint === undefined) {
            start = previous?.finished ? null : previous;
        }
        const resumed = checkpoint === undefined && start !== null;
        if (checkpoint === undefined && start === null) {
            if (!this.position.finished && this.position.index >= 0) start = this.position;
        }
        return {start, resumed};
    }

    async #restorePosition(start: DatabaseCursorPosition | null): Promise<void> {
        if (!start || start.index < 0) {
            return;
        }
        while (this.position.index < start.index) {
            const page = await this.next(1, null);
            if (!page?.length) {
                fail("database/invalid-argument", "Checkpoint is no longer reachable.");
            }
        }
        if (this.position.index !== start.index || this.position.key !== start.key) {
            fail("database/invalid-argument", "Checkpoint no longer matches cursor order.");
        }
    }

    async #readAllPage(size: number, readOnly: boolean): Promise<{
        count: number;
        changes: Map<DatabasePath, DatabaseValue>
    }> {
        const changes = new Map<DatabasePath, DatabaseValue>();
        const original = this.handle;
        const wrapped = original ? async (entry: DatabaseEntry) => {
            const replacement = await original(entry);
            if (replacement !== undefined) {
                if (readOnly) {
                    fail("database/invalid-argument", "Frontend cursor all() cannot change records.");
                }
                changes.set(await recordPath(this.#path!, entry, this._database), replacement as DatabaseValue);
            }
            return undefined;
        } : undefined;
        const page = await this.next(size, wrapped);
        if (page === undefined) {
            fail("database/unknown", "Cursor page failed without an error.");
        }
        return {count: page.filter(entry => "value" in entry).length, changes};
    }

    async #writeAllPage(
        changes: Map<DatabasePath, DatabaseValue>,
        position: DatabaseCursorPosition,
        count: number,
        startedAt: number,
        userId: string | null
    ): Promise<void> {
        const now = Date.now();
        const status: CursorStatus = {
            checkpoint: position,
            count,
            finishedAt: position.finished ? now : null,
            startedAt,
            state: position.finished ? "ready" : "running",
            updatedAt: now,
            userId,
        };
        changes.set(this.#statusPath(), {
            ...status,
            checkpoint: {...position, key: position.key ?? null}
        } as unknown as DatabaseValue);
        await this._backend!.request("database.update", "", changes);
    }

    async #writeAllFailure(
        error: unknown,
        saved: DatabaseCursorPosition | null,
        count: number,
        startedAt: number,
        userId: string | null
    ): Promise<void> {
        const now = Date.now();
        let code = "database/unknown";
        if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
            code = error.code;
        }
        const failure: CursorStatus = {
            checkpoint: saved,
            count,
            error: {
                code,
                message: error instanceof Error ? error.message : String(error)
            },
            finishedAt: null,
            startedAt,
            state: "failed",
            updatedAt: now,
            userId
        };
        try {
            await this._backend!.request("database.update", "", new Map([[this.#statusPath(), {
                ...failure, checkpoint: saved ? {...saved, key: saved.key ?? null} : null
            } as unknown as DatabaseValue]]));
        } catch { /* Preserve the original page or commit error. */
        }
    }
}

async function recordPath(source: DatabasePath, entry: DatabaseEntry, database?: DatabaseBase): Promise<DatabasePath> {
    const branch = Array.isArray(source)
        ? source.map(segment => {
            if (typeof segment !== "string" || !entry.params || !Object.hasOwn(entry.params, segment)) {
                return segment;
            }
            return {[segment]: entry.params[segment]};
        })
        : source;
    if (database && "storageId" in database && typeof database.storageId === "string") {
        const parsed = parseLocalPath(branch, "collection");
        if (!parsed.effectivePath.length) {
            return [entry.key];
        }
        return getChildRecordPath(database.storageId, parsed.effectivePath, entry.key, parsed.keyField);
    }
    const parsed = parseFirebasePath(branch, "collection");
    if (parsed.keyField) {
        return [
            ...parsed.effectivePath as (string | Record<string, string>)[],
            {[parsed.keyField]: entry.key}];
    }
    if (parsed.address) {
        return `${parsed.address}/${entry.key}`;
    }
    return entry.key;
}

function validateAllArguments(size: number, checkpoint?: DatabaseCursorPosition | null): void {
    if (!Number.isSafeInteger(size) || size <= 0) {
        fail("database/invalid-argument", "size must be a positive safe integer.");
    }
    if (checkpoint === undefined || checkpoint === null) {
        return;
    }
    if (!Number.isSafeInteger(checkpoint.index) || checkpoint.index < -1) {
        fail("database/invalid-argument", "Invalid checkpoint.");
    }
    if (checkpoint.index === -1 && checkpoint.key !== undefined) {
        fail("database/invalid-argument", "Invalid checkpoint.");
    }
    if (checkpoint.index !== -1 && typeof checkpoint.key !== "string") {
        fail("database/invalid-argument", "Invalid checkpoint.");
    }
    if (typeof checkpoint.finished !== "boolean") {
        fail("database/invalid-argument", "Invalid checkpoint.");
    }
}
