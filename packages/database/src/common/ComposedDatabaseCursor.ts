import {fail} from "../../../common";
import resolvePath from "./resolvePath";
import {DatabaseCursor} from "./DatabaseCursor";
import type {
    DatabasePath, DatabaseEntry, DatabaseGroupEntry, DatabaseCursorEvent,
    DatabaseCursorOptions, DatabaseCursorSubscription, DatabaseOptions
} from "./DatabaseTypes";

type CursorInput = (DatabaseCursorOptions & {path: DatabasePath}) | DatabaseCursor | null | undefined;
type CursorPath = DatabasePath | CursorInput[];
type Source = {
    cursor: DatabaseCursor;
    entries: (DatabaseEntry | DatabaseGroupEntry)[];
    offset: number;
    headers: DatabaseGroupEntry[];
};
type NextProps = {n: number; byGroup: boolean; entries: (DatabaseEntry | DatabaseGroupEntry)[]};
type SourceProps = NextProps & {source: Source};

type CreateCursor = (path: DatabasePath, options: DatabaseCursorOptions) => DatabaseCursor | undefined;

interface CursorRun {
    <T>(operation: () => Promise<T>, options: DatabaseOptions | undefined, reason: string,
        context: Record<string, unknown>): Promise<T | undefined>;
    <T>(operation: () => T, options: DatabaseOptions | undefined, reason: string,
        context: Record<string, unknown>): T | undefined;
}

const isRecord = (entry: DatabaseEntry | DatabaseGroupEntry): entry is DatabaseEntry => "value" in entry;

const headerParents = new WeakMap<DatabaseGroupEntry, DatabaseGroupEntry>();

function isSourceAvailable(source: Source): boolean {
    return source.offset < source.entries.length || !source.cursor.position.finished;
}

function validateBatch(batch: (DatabaseEntry | DatabaseGroupEntry)[], limit: number, finished: boolean): true {
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

function appendUniqueEntry(props: SourceProps & {
    entry: DatabaseEntry; origin: DatabaseCursor;
    seen: Map<string, Set<string>>; origins: WeakMap<DatabaseEntry, DatabaseCursor>;
}) {
    const {source, entries, entry, origin, seen, origins} = props;
    const identity = origin.path === undefined
        ? `id:${origin.id}`
        : `path:${resolvePath(origin.path)}`;
    let keys = seen.get(identity);
    if (!keys) {
        keys = new Set();
        seen.set(identity, keys);
    }
    if (!keys.has(entry.key)) {
        keys.add(entry.key);
        const returned = origins.has(entry) && origins.get(entry) !== origin ? {...entry} : entry;
        origins.set(returned, origin);
        entries.push(...source.headers.splice(0), returned);
    }
    return {...props, source, entries, seen, origins};
}

function formPage(props: NextProps & {header: (DatabaseEntry | DatabaseGroupEntry)[]; heading: DatabaseGroupEntry | undefined}) {
    const {n, byGroup, entries, header, heading} = props;
    const result = entries.splice(0, byGroup ? entries.length : n);
    if (result.length) result.unshift(...header.splice(0));
    if (heading) {
        for (const entry of result) {
            if (!isRecord(entry) && entry !== heading && !headerParents.has(entry)) {
                headerParents.set(entry, heading);
            }
        }
    }
    return {...props, entries, header, result};
}

function unsubscribeSources(subscriptions: {subscription: DatabaseCursorSubscription; cursor: DatabaseCursor}[],
    run: CursorRun, onError: DatabaseOptions["onError"]): void {
    let failure: {error: unknown} | undefined;
    for (const {subscription, cursor} of subscriptions) {
        try {
            if (cursor instanceof ComposedDatabaseCursor) subscription.unsubscribe();
            else {
                run(() => subscription.unsubscribe(), {onError: cursor.onError ?? onError},
                    "cursor.unsubscribe", {path: cursor.path});
            }
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
    readonly #context: Record<string, unknown>;
    readonly #seen = new Map<string, Set<string>>();
    // Entry objects stay plain; nested compositions retain their original leaf cursor.
    readonly #origins = new WeakMap<DatabaseEntry, DatabaseCursor>();
    #header: (DatabaseEntry | DatabaseGroupEntry)[] = [];
    #pending: (DatabaseEntry | DatabaseGroupEntry)[] = [];
    #turn = 0;

    static #hasGroup(cursor: DatabaseCursor): boolean {
        return cursor.group !== undefined || (cursor instanceof ComposedDatabaseCursor &&
            cursor.#sources.some(source => ComposedDatabaseCursor.#hasGroup(source.cursor)));
    }

    constructor(sources: Source[], options: DatabaseCursorOptions, run: CursorRun, path: CursorPath,
        cursorPath?: () => DatabasePath) {
        super(options, cursorPath?.() ?? (typeof path === "string" || (path instanceof Array &&
            (path.length === 0 || typeof path[0] === "string"))
            ? path as DatabasePath
            : undefined));
        this.#context = {path};
        this.#run = run;
        this.#sources = sources;
    }

    async next(n = 1): Promise<(DatabaseEntry | DatabaseGroupEntry)[] | undefined> {
        let props = await this.#prepareNext(n);
        if (!props) return undefined;
        try {
            const collected = await this.#collectEntries(props);
            if (!collected) {
                this.#pending = props.entries;
                return undefined;
            }
            props = collected;
        } catch (error) {
            this.#pending = props.entries;
            throw error;
        }
        return this.#commitNext(formPage({...props, header: this.#header, heading: this._heading}));
    }

    async #prepareNext(n: number): Promise<NextProps | undefined> {
        const valid = await this.#run(async () => {
            this.#header.push(...await super.next(n) ?? []);
            return true;
        }, {onError: this.onError}, "cursor.next", {...this.#context, n});
        if (!valid) return undefined;
        const props = {n, byGroup: ComposedDatabaseCursor.#hasGroup(this), entries: this.#pending};
        this.#pending = [];
        return props;
    }

    async #collectEntries(props: NextProps): Promise<NextProps | undefined> {
        const {n, byGroup} = props;
        while (byGroup
            ? this.#turn < this.#sources.length
            : props.entries.length < n && this.#sources.some(isSourceAvailable)) {
            const source = this.#sources[this.#turn];
            if (isSourceAvailable(source)) {
                const filled = await this.#fillSource({...props, source});
                if (!filled) return undefined;
                const consumed = this.#consumeSource(filled);
                props = {...props, entries: consumed.entries};
            }
            this.#turn = byGroup ? this.#turn + 1 : (this.#turn + 1) % this.#sources.length;
        }
        return {...props, entries: props.entries};
    }

    async #fillSource(props: SourceProps): Promise<SourceProps | undefined> {
        const {source, n} = props;
        if (source.offset < source.entries.length) return props;
        const read = () => source.cursor.next(n);
        const batch = source.cursor instanceof ComposedDatabaseCursor
            ? await read()
            : await this.#run(read, {onError: source.cursor.onError ?? this.onError},
                "cursor.next", {path: source.cursor.path, n});
        if (batch === undefined) return undefined;
        const valid = this.#run(() => validateBatch(batch,
            ComposedDatabaseCursor.#hasGroup(source.cursor) ? Infinity : n,
            source.cursor.position.finished), {onError: this.onError},
        "cursor.next", {path: source.cursor.path, n});
        if (!valid) return undefined;
        source.entries = batch;
        source.offset = 0;
        return {...props, source};
    }

    #consumeSource(props: SourceProps): SourceProps {
        const {source, byGroup} = props;
        let {entries} = props;
        for (let repeat = true; repeat; repeat = byGroup) {
            if (source.offset === source.entries.length) break;
            const entry = source.entries[source.offset++];
            if (!isRecord(entry)) {
                source.headers = source.headers.filter(header => isHeaderAncestor(header, entry));
                source.headers.push(entry);
                continue;
            }
            const origin = source.cursor instanceof ComposedDatabaseCursor
                ? source.cursor.#origins.get(entry)!
                : source.cursor;
            const appended = appendUniqueEntry({
                ...props,
                entries,
                entry,
                origin,
                seen: this.#seen,
                origins: this.#origins
            });
            entries = appended.entries;
        }
        return {...props, source, entries};
    }

    #commitNext(props: NextProps & {result: (DatabaseEntry | DatabaseGroupEntry)[]}): (DatabaseEntry | DatabaseGroupEntry)[] {
        const {byGroup, entries, result} = props;
        if (byGroup) this.#turn = 0;
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
                    }), {
                        onError: (error, reason, context) => {
                            if (callbackFailure && Object.is(callbackFailure.error, error)) throw error;
                            onError(error, reason, context);
                        }
                    }, "cursor.subscribe", context);
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
        run: CursorRun, path: CursorPath, cursorPath?: () => DatabasePath): ComposedDatabaseCursor | undefined {
        const sources: Source[] = [];
        const composition = run(() => {
            const composition = new ComposedDatabaseCursor(sources, options, run, path, cursorPath);
            const cursors = new Set<DatabaseCursor>();
            for (const description of queries) {
                if (description == null) continue;
                if (description instanceof DatabaseCursor) {
                    this._assertFresh(description);
                    if (cursors.has(description)) {
                        fail("database/invalid-argument", "Composition requires distinct cursor instances.");
                    }
                    cursors.add(description);
                } else if (typeof description !== "object" || description instanceof Array ||
                    !(typeof description.path === "string" || (description.path instanceof Array &&
                        (description.path.length === 0 || typeof description.path[0] === "string")))) {
                    fail("database/invalid-argument", "Each cursor source must be a DatabaseCursor or an object with a path.");
                }
            }
            return composition;
        }, options, "cursor", {path});
        if (composition === undefined) return undefined;
        const shared = {...options};
        delete shared.group;
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
    createCursor: CreateCursor, run: CursorRun, path: CursorPath = queries, cursorPath?: () => DatabasePath
): ComposedDatabaseCursor | undefined {
    return ComposedDatabaseCursor.create(queries, options, createCursor, run, path, cursorPath);
}
