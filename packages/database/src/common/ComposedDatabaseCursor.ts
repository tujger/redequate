import {fail} from "../../../common";
import {DatabaseCursor} from "./DatabaseCursor";
import type {
    DatabasePath, DatabaseCursorSource, DatabaseEntry, DatabaseGroupEntry,
    DatabaseCursorEvent, DatabaseCursorOptions, DatabaseCursorSubscription,
    DatabaseErrorContext, DatabaseOptions
} from "./DatabaseBase";

type CursorInput = DatabaseCursorSource | DatabaseCursor | null | undefined;
type CursorEntry = DatabaseEntry | DatabaseGroupEntry;
type CursorPath = DatabasePath | CursorInput[];
type Source = {
    cursor: DatabaseCursor;
    entries: CursorEntry[];
    offset: number;
    headers: DatabaseGroupEntry[];
};
type CreateCursor = (path: DatabasePath, options: DatabaseCursorOptions) => DatabaseCursor | undefined;

interface CursorRun {
    <T>(operation: () => Promise<T>, options: DatabaseOptions | undefined, reason: string,
        context: DatabaseErrorContext): Promise<T | undefined>;
    <T>(operation: () => T, options: DatabaseOptions | undefined, reason: string,
        context: DatabaseErrorContext): T | undefined;
}

const isRecord = (entry: CursorEntry): entry is DatabaseEntry => "value" in entry;

const headerParents = new WeakMap<DatabaseGroupEntry, DatabaseGroupEntry>();

function isSourceAvailable(source: Source): boolean {
    return source.offset < source.entries.length || !source.cursor.position.finished;
}

function validateBatch(batch: CursorEntry[], limit: number, finished: boolean): true {
    if (!(batch instanceof Array) || batch.length > limit || (!batch.length && !finished)) {
        fail("database/invalid-argument", "Cursor next(n) must return an entry array within its page size, or undefined; an empty result must be finished.");
    }
    if (batch.some(entry => !entry || typeof entry !== "object" || typeof entry.key !== "string")) {
        fail("database/invalid-argument", "Cursor entries and group headings must have a string key.");
    }
    return true;
}

function isHeaderAncestor(header: DatabaseGroupEntry, entry: DatabaseGroupEntry): boolean {
    for (let parent = headerParents.get(entry); parent; parent = headerParents.get(parent)) {
        if (parent === header) return true;
    }
    return false;
}

function unsubscribeSources(subscriptions: {subscription: DatabaseCursorSubscription; cursor: DatabaseCursor}[],
    run: CursorRun, onError: DatabaseOptions["onError"]): void {
    let failure: {error: unknown} | undefined;
    for (const {subscription, cursor} of subscriptions) {
        try {
            if (cursor instanceof ComposedDatabaseCursor) subscription.unsubscribe();
            else run(() => subscription.unsubscribe(), {onError: cursor.onError ?? onError},
                "cursor.unsubscribe", {path: cursor.path});
        } catch (error) {
            failure ??= {error};
        }
    }
    if (failure) throw failure.error;
}

export default class ComposedDatabaseCursor extends DatabaseCursor {
    readonly #sources: Source[];
    readonly #run: CursorRun;
    // The caller's original argument is needed for validation error contexts.
    readonly #context: DatabaseErrorContext;
    readonly #seen = new Map<string, Set<string>>();
    // Entry objects stay plain; nested compositions retain their original leaf cursor.
    readonly #origins = new WeakMap<DatabaseEntry, DatabaseCursor>();
    #header: CursorEntry[] = [];
    #pending: CursorEntry[] = [];
    #turn = 0;

    static #hasGroup(cursor: DatabaseCursor): boolean {
        return cursor.group !== undefined || cursor instanceof ComposedDatabaseCursor
            && cursor.#sources.some(source => ComposedDatabaseCursor.#hasGroup(source.cursor));
    }

    constructor(sources: Source[], options: DatabaseCursorOptions, run: CursorRun, path: CursorPath) {
        super(options, typeof path === "string" || path instanceof Array && path.every(part => typeof part === "string")
            ? path as DatabasePath : undefined);
        this.#context = {path};
        this.#run = run;
        this.#sources = sources;
    }

    async next(n = 1): Promise<CursorEntry[] | undefined> {
        const valid = await this.#run(async () => {
            this.#header.push(...await super.next(n) ?? []);
            return true;
        }, {onError: this.onError}, "cursor.next", {...this.#context, n});
        if (!valid) return undefined;

        const byGroup = ComposedDatabaseCursor.#hasGroup(this);
        const entries = this.#pending;
        this.#pending = [];
        try {
            while (byGroup ? this.#turn < this.#sources.length
                : entries.length < n && this.#sources.some(isSourceAvailable)) {
                const source = this.#sources[this.#turn];
                if (isSourceAvailable(source)) {
                    if (source.offset === source.entries.length) {
                        const read = () => source.cursor.next(n);
                        const batch = source.cursor instanceof ComposedDatabaseCursor
                            ? await read()
                            : await this.#run(read, {onError: source.cursor.onError ?? this.onError},
                                "cursor.next", {path: source.cursor.path, n});
                        if (batch !== undefined) {
                            const valid = this.#run(() => validateBatch(batch,
                                ComposedDatabaseCursor.#hasGroup(source.cursor) ? Infinity : n,
                                source.cursor.position.finished), {onError: this.onError},
                                "cursor.next", {path: source.cursor.path, n});
                            if (!valid) {
                                this.#pending = entries;
                                return undefined;
                            }
                        }
                        if (batch === undefined) {
                            this.#pending = entries;
                            return undefined;
                        }
                        source.entries = batch;
                        source.offset = 0;
                    }
                    do {
                        if (source.offset === source.entries.length) break;
                        const entry = source.entries[source.offset++];
                        if (!isRecord(entry)) {
                            source.headers = source.headers.filter(header => isHeaderAncestor(header, entry));
                            source.headers.push(entry);
                            continue;
                        }
                        const origin = source.cursor instanceof ComposedDatabaseCursor
                            ? source.cursor.#origins.get(entry)! : source.cursor;
                        const identity = origin.path === undefined ? `id:${origin.id}` : `path:${origin.path}`;
                        let keys = this.#seen.get(identity);
                        if (!keys) {
                            keys = new Set();
                            this.#seen.set(identity, keys);
                        }
                        if (!keys.has(entry.key)) {
                            keys.add(entry.key);
                            const returned = this.#origins.has(entry) && this.#origins.get(entry) !== origin
                                ? {...entry} : entry;
                            this.#origins.set(returned, origin);
                            entries.push(...source.headers.splice(0), returned);
                        }
                    } while (byGroup);
                }
                this.#turn = byGroup ? this.#turn + 1 : (this.#turn + 1) % this.#sources.length;
            }
        } catch (error) {
            this.#pending = entries;
            throw error;
        }
        if (byGroup) this.#turn = 0;
        const result = entries.splice(0, byGroup ? entries.length : n);
        if (result.length) result.unshift(...this.#header.splice(0));
        if (this._heading) {
            for (const entry of result) {
                if (!isRecord(entry) && entry !== this._heading && !headerParents.has(entry)) {
                    headerParents.set(entry, this._heading);
                }
            }
        }
        this.#pending = entries;
        this._position = Object.freeze({
            index: this._position.index + result.length,
            key: result.length ? result[result.length - 1].key : this._position.key,
            finished: !this.#pending.length && !this.#sources.some(isSourceAvailable)
        });
        this._count += result.length;
        return result;
    }

    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        const valid = this.#run(() => {
            super.subscribe(listener);
            return true;
        }, {onError: this.onError}, "cursor.subscribe", this.#context);
        if (!valid) return undefined;

        const subscriptions: {subscription: DatabaseCursorSubscription; cursor: DatabaseCursor}[] = [];
        const counters = {add: "added", change: "changed", remove: "removed"} as const;
        const cursor = this;
        const subscribed = {
            get id() { return cursor.id; },
            subscribed: new Date(),
            active: true,
            added: 0,
            changed: 0,
            removed: 0,
            unsubscribe: () => {
                if (!subscribed.active) return;
                subscribed.active = false;
                unsubscribeSources(subscriptions, this.#run, this.onError);
            }
        };
        try {
            for (const {cursor} of this.#sources) {
                const context = {path: cursor.path};
                const notify = (event: DatabaseCursorEvent) => {
                    if (!subscribed.active) return;
                    this._started = true;
                    subscribed[counters[event.type]]++;
                    this._count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
                    return listener(event);
                };
                const onError = cursor.onError ?? this.onError ?? ((error: unknown) => { throw error; });
                let callbackFailure: {error: unknown} | undefined;
                const subscription = cursor instanceof ComposedDatabaseCursor
                    ? cursor.subscribe(notify)
                    : this.#run(() => cursor.subscribe(event => {
                        try {
                            return this.#run(() => notify(event), {onError}, "cursor.subscribe", context);
                        } catch (error) {
                            callbackFailure = {error};
                            throw error;
                        }
                    }), {onError: (error, reason, context) => {
                        if (callbackFailure && Object.is(callbackFailure.error, error)) throw error;
                        onError(error, reason, context);
                    }}, "cursor.subscribe", context);
                if (subscription === undefined) {
                    subscribed.unsubscribe();
                    return undefined;
                }
                subscriptions.push({subscription, cursor});
            }
        } catch (error) {
            subscribed.unsubscribe();
            throw error;
        }
        return subscribed;
    }

    static create(queries: CursorInput[], options: DatabaseCursorOptions, createCursor: CreateCursor,
        run: CursorRun, path: CursorPath): ComposedDatabaseCursor | undefined {
        const sources: Source[] = [];
        const composition = run(() => {
            const composition = new ComposedDatabaseCursor(sources, options, run, path);
            const cursors = new Set<DatabaseCursor>();
            for (const description of queries) {
                if (description == null) continue;
                if (description instanceof DatabaseCursor) {
                    this._assertFresh(description);
                    if (cursors.has(description)) {
                        fail("database/invalid-argument", "Composition requires distinct cursor instances.");
                    }
                    cursors.add(description);
                } else if (typeof description !== "object" || description instanceof Array
                    || !(typeof description.path === "string" || description.path instanceof Array
                        && description.path.every(part => typeof part === "string"))) {
                    fail("database/invalid-argument", "Each cursor source must be a DatabaseCursor or an object with a path.");
                }
            }
            return composition;
        }, options, "cursor", {path});
        if (composition === undefined) return undefined;
        const {group, ...shared} = options;
        for (const description of queries) {
            if (description == null) continue;
            let cursor: DatabaseCursor | undefined;
            if (description instanceof DatabaseCursor) cursor = description;
            else {
                const {path, ...individual} = description;
                const effective = {...shared, ...individual};
                cursor = run(() => createCursor(path, effective), effective, "cursor", {path});
            }
            if (cursor === undefined) return undefined;
            sources.push({cursor, entries: [], offset: 0, headers: []});
        }
        return composition;
    }
}

export function composeCursor(queries: CursorInput[], options: DatabaseCursorOptions,
    createCursor: CreateCursor, run: CursorRun, path: CursorPath = queries
): ComposedDatabaseCursor | undefined {
    return ComposedDatabaseCursor.create(queries, options, createCursor, run, path);
}
