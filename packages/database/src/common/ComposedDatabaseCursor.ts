import {fail} from "../../../common";
import {DatabaseCursor} from "./DatabaseCursor";
import normalizePath from "./normalizePath";
import type {
    DatabasePath, DatabaseCursorSource, DatabaseCursorEntry, DatabaseCursorGroupEntry,
    DatabaseCursorEvent, DatabaseCursorOptions, DatabaseCursorSubscription,
    DatabaseErrorContext, DatabaseOptions
} from "./DatabaseBase";

type CursorEntry = DatabaseCursorEntry | DatabaseCursorGroupEntry;
type CursorInput = DatabaseCursorSource | DatabaseCursor;
type CursorPath = DatabasePath | CursorInput[];
type CursorSource = Pick<DatabaseCursor, "next" | "count" | "position" | "group"> & {
    subscribe(listener: (event: DatabaseCursorEvent) => void): Pick<DatabaseCursorSubscription, "unsubscribe"> | undefined;
};
type SourceDescription = {
    path?: DatabasePath;
    cursor?: DatabaseCursor;
    options: DatabaseCursorOptions;
};
type Source = {
    cursor: CursorSource;
    path?: DatabasePath;
    options: DatabaseCursorOptions;
    entries: CursorEntry[];
    offset: number;
    headers: DatabaseCursorGroupEntry[];
};
type CreateCursor = (path: DatabasePath, options: DatabaseCursorOptions) => CursorSource | undefined;
interface CursorRun {
    <T>(operation: () => Promise<T>, options: DatabaseOptions | undefined, reason: string,
        context: DatabaseErrorContext): Promise<T | undefined>;
    <T>(operation: () => T, options: DatabaseOptions | undefined, reason: string,
        context: DatabaseErrorContext): T | undefined;
}

const headerParents = new WeakMap<DatabaseCursorGroupEntry, DatabaseCursorGroupEntry>();
const isHeader = (entry: CursorEntry): entry is DatabaseCursorGroupEntry => entry
    && (entry as DatabaseCursorEntry).path === undefined
    && typeof (entry.value as {group?: unknown} | null)?.group === "string";

export default class ComposedDatabaseCursor extends DatabaseCursor {
    readonly #sources: Source[];
    readonly #run: CursorRun;
    readonly #path: CursorPath;
    readonly #seen = new Map<string, Set<string>>();
    #heading?: DatabaseCursorGroupEntry;
    readonly #header: DatabaseCursorGroupEntry[] = [];
    #pending: CursorEntry[] = [];
    #turn = 0;

    static #hasGroup(cursor: CursorSource): boolean {
        return cursor.group !== undefined || cursor instanceof ComposedDatabaseCursor
            && cursor.#sources.some(source => source.options.group !== undefined
                || ComposedDatabaseCursor.#hasGroup(source.cursor));
    }

    static #available(source: Source): boolean {
        return source.offset < source.entries.length || !source.cursor.position.finished;
    }

    constructor(sources: Source[], options: DatabaseCursorOptions, run: CursorRun, path: CursorPath) {
        super(options, typeof path === "string" || path instanceof Array && path.every(part => typeof part === "string")
            ? path as DatabasePath : undefined);
        this.#sources = sources;
        this.#run = run;
        this.#path = path;
    }

    async next(n = 1): Promise<CursorEntry[] | undefined> {
        const valid = await this.#run(async () => {
            const position = this._position;
            const heading = await super.next(n);
            if (heading?.length) {
                this.#heading = heading[0] as DatabaseCursorGroupEntry;
                this.#header.push(this.#heading);
                // Commit the heading only with a successful, non-empty result.
                this._count -= heading.length;
                this._position = position;
            }
            return true;
        }, {onError: this.onError}, "cursor.next", {path: this.#path, n});
        if (!valid) return undefined;

        const byGroup = ComposedDatabaseCursor.#hasGroup(this);
        const entries = this.#pending;
        this.#pending = [];
        try {
            while (byGroup ? this.#turn < this.#sources.length
                : entries.length < n && this.#sources.some(ComposedDatabaseCursor.#available)) {
                const source = this.#sources[this.#turn];
                if (ComposedDatabaseCursor.#available(source)) {
                    if (source.offset === source.entries.length) {
                        const batch = await this.#run(async () => {
                            const entries = await source.cursor.next(n);
                            if (entries !== undefined && (!(entries instanceof Array)
                                || (!ComposedDatabaseCursor.#hasGroup(source.cursor)
                                    && entries.filter(entry => !isHeader(entry)).length > n)
                                || (!entries.length && !source.cursor.position.finished))) {
                                fail("database/invalid-argument", "Cursor next(n) must return an entry array within its page size, or undefined; an empty result must be finished.");
                            }
                            if (entries?.some(entry => !entry || typeof entry.key !== "string"
                                || !isHeader(entry) && !(typeof entry.path === "string" || entry.path instanceof Array
                                    && entry.path.every(part => typeof part === "string")))) {
                                fail("database/invalid-argument", "Cursor entries must have a key and a source collection path.");
                            }
                            return entries;
                        }, source.options, "cursor.next", {path: source.path, n});
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
                        if (isHeader(entry)) {
                            source.headers = source.headers.filter(header => {
                                for (let parent = headerParents.get(entry); parent; parent = headerParents.get(parent)) {
                                    if (parent === header) return true;
                                }
                                return false;
                            });
                            source.headers.push(entry);
                            continue;
                        }
                        const path = normalizePath(entry.path);
                        let keys = this.#seen.get(path);
                        if (!keys) {
                            keys = new Set();
                            this.#seen.set(path, keys);
                        }
                        if (!keys.has(entry.key)) {
                            keys.add(entry.key);
                            entries.push(...source.headers.splice(0), entry);
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
        if (this.#heading) {
            for (const entry of result) {
                if (isHeader(entry) && entry !== this.#heading && !headerParents.has(entry)) headerParents.set(entry, this.#heading);
            }
        }
        this.#pending = entries;
        this._position = Object.freeze({
            index: this._position.index + result.length,
            key: result.length ? result[result.length - 1].key : this._position.key,
            finished: !this.#pending.length && !this.#sources.some(ComposedDatabaseCursor.#available)
        });
        this._count += result.length;
        return result;
    }

    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        const valid = this.#run(() => {
            super.subscribe(listener);
            return true;
        }, {onError: this.onError}, "cursor.subscribe", {path: this.#path});
        if (!valid) return undefined;

        const subscriptions: {subscription: Pick<DatabaseCursorSubscription, "unsubscribe">; source: Source}[] = [];
        const counters = {add: "added", change: "changed", remove: "removed"} as const;
        const unsubscribe = () => {
            for (const {subscription, source} of subscriptions) {
                this.#run(() => subscription.unsubscribe(), source.options, "cursor.unsubscribe", {path: source.path});
            }
            subscribed.active = false;
        };
        const subscribed = {
            id: this.id,
            subscribed: new Date(),
            active: true,
            added: 0,
            changed: 0,
            removed: 0,
            unsubscribe
        };
        try {
            for (const source of this.#sources) {
                const context = {path: source.path};
                const subscription = this.#run(() => source.cursor.subscribe(event => {
                    subscribed[counters[event.type]]++;
                    this._count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
                    return this.#run(() => listener(event), source.options, "cursor.subscribe", context);
                }), source.options, "cursor.subscribe", context);
                if (subscription === undefined) {
                    unsubscribe();
                    return undefined;
                }
                subscriptions.push({subscription, source});
            }
        } catch (error) {
            unsubscribe();
            throw error;
        }
        return subscribed;
    }
}

export function composeCursor(queries: CursorInput[], options: DatabaseCursorOptions,
    createCursor: CreateCursor, run: CursorRun, path: CursorPath = queries
): ComposedDatabaseCursor | undefined {
    const sources: Source[] = [];
    const result = run(() => new ComposedDatabaseCursor(sources, options, run, path), options, "cursor", {path});
    if (result === undefined || !createSources(sources, queries, options, createCursor, run, path)) return undefined;
    return result;
}

function createSources(sources: Source[], queries: CursorInput[], options: DatabaseCursorOptions,
    createCursor: CreateCursor, run: CursorRun, path: CursorPath): boolean {
    const descriptions = run(() => {
        const {group, ...shared} = options;
        const cursors = new Set<DatabaseCursor>();
        return queries.map((description): SourceDescription => {
            if (description instanceof DatabaseCursor) {
                if (cursors.has(description) || description.position.index !== -1
                    || description.position.key !== undefined || description.position.finished || description.count !== 0) {
                    fail("database/invalid-argument", "Composition requires fresh, distinct cursors used exclusively by the composition.");
                }
                cursors.add(description);
                return {cursor: description, options: {onError: options.onError}};
            }
            if (description === null || typeof description !== "object" || description instanceof Array) {
                fail("database/invalid-argument", "Each cursor source must be a DatabaseCursor implementation or an object with a path.");
            }
            const {path, ...individual} = description;
            if (typeof path !== "string" && !(path instanceof Array && path.every(part => typeof part === "string"))) {
                fail("database/invalid-argument", "A cursor source path must be a string or string array.");
            }
            return {path, options: {...shared, ...individual}};
        });
    }, options, "cursor", {path});
    if (descriptions === undefined) return false;

    for (const description of descriptions) {
        const sourceOptions: DatabaseCursorOptions = {
            ...description.options,
            onError: (error, reason, context) => run(() => { throw error; }, description.options, reason, context)
        };
        const cursor = description.cursor ?? run(() => createCursor(description.path!, sourceOptions),
            description.options, "cursor", {path: description.path});
        if (cursor === undefined) return false;
        sources.push({
            cursor,
            path: description.path,
            options: description.options,
            entries: [],
            offset: 0,
            headers: []
        });
    }
    return true;
}
