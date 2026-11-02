import {fail, notImplemented} from "../../../common";
import {key} from "firebase-key";
import DatabaseCursor from "./DatabaseCursor";
import type BackendBase from "../../../backend/src/common/BackendBase";
import type {
    DatabasePath, DatabaseEntry, DatabaseGroupEntry, DatabaseValue,
    DatabaseCursorOptions, DatabaseCursorEvent, DatabaseCursorSubscription
} from "./DatabaseTypes";
import {DatabaseOrder} from "./DatabaseOrder";
import compareValues from "./compareValues";
import compareKeys from "./compareKeys";
import {hasIntermediateWildcard, validateCursorPattern, expandCursorBranches, compareCursorPaths} from "./cursorPath";
import update from "./methods/update";
import parsePath from "../firebase/parsePath";

// Queries are opaque SDK handles; both SDKs expose the snapshot operations below.
type CursorQuery = object;
type QueryMethod = "orderByChild" | "orderByValue" | "orderByKey" | "equalTo" |
    "startAt" | "endAt" | "limitToFirst" | "limitToLast";

interface CursorSnapshot {
    readonly key: string | null;
    readonly ref: CursorQuery;
    val(): DatabaseValue;
    exists(): boolean;
    child(path: string): CursorSnapshot;
    forEach(callback: (child: CursorChildSnapshot) => boolean | void): boolean | void;
}
interface CursorChildSnapshot extends CursorSnapshot { readonly key: string; }

interface CursorQueryState {
    initialQuery: CursorQuery;
    continuationQuery: CursorQuery;
    ascending: boolean;
    orderBy?: string;
    byValue: boolean;
    startKey?: string;
    endKey?: string;
}
interface CursorState extends CursorQueryState {
    backend?: BackendBase;
    path: string;
    parentPath: DatabasePath;
    keyField?: string;
    params?: Record<string, string>;
    scanKey?: string;
    scanValue?: DatabaseValue;
    buffer: CursorChildSnapshot[];
    offset: number;
    exhausted: boolean;
    pending?: CursorCandidate;
}
interface CursorRead {
    state: CursorState;
    n: number;
    entries: DatabaseEntry[];
    handle?: DatabaseCursorOptions["handle"];
    child?: CursorChildSnapshot;
    sortValue?: DatabaseValue;
    entry?: DatabaseEntry;
    replacement?: DatabaseValue | void;
}
interface CursorCandidate extends CursorRead {
    child: CursorChildSnapshot;
    sortValue: DatabaseValue;
}
interface CursorPage extends CursorRead {
    key?: string;
    value?: DatabaseValue;
    size: number;
    query?: CursorQuery;
    snapshot?: CursorSnapshot;
    children?: CursorChildSnapshot[];
}
type CursorPageResult = CursorPage & {children: CursorChildSnapshot[]};

/** Shared RTDB cursor engine; subclasses supply SDK operations only. */
export default class FirebaseCursorBase extends DatabaseCursor {
    readonly #inputPath: DatabasePath;
    readonly #backend?: BackendBase;
    #states?: CursorState[];
    #initializing?: Promise<void>;
    #header: (DatabaseEntry | DatabaseGroupEntry)[] = [];
    protected readonly _wildcard: boolean;

    constructor(path: DatabasePath, options: DatabaseCursorOptions = {}, backend?: BackendBase) {
        const wildcard = hasIntermediateWildcard(path);
        super(options, wildcard ? path : parsePath(path, "collection").address);
        validateCursorPattern(path);
        this._wildcard = wildcard;
        this.#inputPath = path;
        this.#backend = backend;
    }

    protected _reference(_address: string): CursorQuery { return notImplemented("cursor reference"); }
    protected _query(_reference: CursorQuery, _method: QueryMethod, ..._args: DatabaseValue[]): CursorQuery { return notImplemented("cursor query"); }
    protected _readSnapshot(_reference: CursorQuery): Promise<CursorSnapshot> { return notImplemented("cursor read"); }

    #createState(path: DatabasePath, params?: Record<string, string>): CursorState {
        const parsed = parsePath(path, "collection");
        return {...this.createCursorQuery(parsed.effectivePath, this),
            backend: this.#backend, path: parsed.address,
            parentPath: parsed.effectivePath, keyField: parsed.keyField, params,
            scanKey: undefined, scanValue: undefined, buffer: [], offset: 0, exhausted: false};
    }

    protected _queryState(): CursorState {
        if (this._wildcard) fail("database/invalid-argument", "Subscriptions to intermediate cursor wildcards are not supported.");
        this.#states ??= [this.#createState(this.#inputPath)];
        return this.#states[0];
    }

    async #initialize(): Promise<void> {
        if (!this._wildcard) { this._queryState(); return; }
        const branches = await expandCursorBranches(this.#inputPath, async path => {
            const snapshot = await this._readSnapshot(this._reference(parsePath(path).address));
            const keys: string[] = [];
            snapshot.forEach(child => { keys.push(child.key); });
            return keys;
        });
        this.#states = branches.map(({path, params}) => this.#createState(path, params));
    }

    async #candidate(state: CursorState): Promise<CursorCandidate | undefined> {
        if (state.pending) return state.pending;
        while (!state.exhausted || state.offset < state.buffer.length) {
            const filled = await this.fillBuffer({state, n: 1, entries: []});
            if (state.offset === state.buffer.length) return;
            const candidate = this.prepareCandidate(filled);
            if (candidate.entry) return state.pending = candidate;
            this.advanceScan(candidate);
        }
    }

    #compare(a: CursorCandidate, b: CursorCandidate): number {
        const byKey = a.state.orderBy === undefined && !a.state.byValue;
        const compared = byKey ? compareKeys(a.sortValue, b.sortValue) : compareValues(a.sortValue, b.sortValue);
        const path = (candidate: CursorCandidate) => [candidate.state.path, candidate.child.key].filter(Boolean).join("/");
        return (compared || compareCursorPaths(path(a), path(b))) * (this.order === "desc" ? -1 : 1);
    }

    async #readWildcard(n: number): Promise<DatabaseEntry[]> {
        const entries: DatabaseEntry[] = [];
        while (entries.length < n) {
            let selected: CursorCandidate | undefined;
            for (const state of this.#states) {
                const candidate = await this.#candidate(state);
                if (candidate && (!selected || this.#compare(candidate, selected) < 0)) selected = candidate;
            }
            if (!selected) break;
            const handled = await this.handleEntry({...selected, handle: this.handle, entries});
            this.advanceScan(handled);
            handled.state.pending = undefined;
        }
        return entries;
    }

    async next(n = 1): Promise<(DatabaseEntry | DatabaseGroupEntry)[]> {
        this.#header.push(...await super.next(n));
        if (this.position.finished) return [];
        if (!this.#states) {
            this.#initializing ??= this.#initialize().catch(error => { this.#initializing = undefined; throw error; });
            await this.#initializing;
        }
        const entries = this._wildcard ? await this.#readWildcard(n)
            : (await this.readEntries({state: this.#states[0], handle: this.handle, n, entries: []})).entries;
        const result = [...this.#header.splice(0), ...entries];
        this._position = Object.freeze({index: this.position.index + result.length,
            key: result.at(-1)?.key ?? this.position.key,
            finished: this.#states.every(state => state.exhausted && state.offset === state.buffer.length)});
        this._count += result.length;
        if (this.position.finished) for (const state of this.#states) { state.buffer = []; state.offset = 0; }
        return result;
    }

    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        super.subscribe(listener);
        if (this._wildcard) fail("database/invalid-argument", "Subscriptions to intermediate cursor wildcards are not supported.");
        return undefined;
    }

    private async readEntries(props: CursorRead): Promise<CursorRead> {
        const {state, n, entries} = props;
        while (entries.length < n) {
            props = await this.fillBuffer(props);
            if (state.offset === state.buffer.length) break;
            props = this.prepareCandidate(props);
            props = await this.handleEntry(props);
            props = this.advanceScan(props);
        }
        return {...props, state, entries};
    }

    private async fillBuffer(props: CursorRead): Promise<CursorRead> {
        const {state, n, entries} = props;
        if (state.offset < state.buffer.length || state.exhausted) return props;
        const page = await this.readPage({...props, key: state.scanKey, value: state.scanValue, size: n - entries.length});
        state.buffer = page.children;
        state.offset = 0;
        state.exhausted = page.children.length < page.size;
        return {...props, state};
    }

    private prepareCandidate(props: CursorRead): CursorCandidate {
        const {state} = props;
        const {byValue, orderBy, startKey, endKey} = state;
        const child = state.buffer[state.offset];
        const byKey = orderBy === undefined && !byValue;
        // Capture the ordered value before handle can replace or delete it.
        const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
        const inRange = (startKey === undefined || child.key >= startKey) &&
            (endKey === undefined || child.key <= endKey);
        return {
            ...props,
            child,
            sortValue,
            entry: inRange && this.hasOrderedField(child, orderBy)
                ? {key: child.key, value: child.val(), ...(state.params ? {params: {...state.params}} : {})} : undefined,
            replacement: undefined
        };
    }

    private hasOrderedField(snapshot: CursorSnapshot, orderBy?: string): boolean { return !orderBy || snapshot.child(orderBy).exists(); }

    private advanceScan(props: CursorRead): CursorRead {
        const {state, child, sortValue, entry, entries} = props;
        state.scanKey = child.key;
        state.scanValue = sortValue;
        state.offset++;
        if (entry !== undefined) entries.push(entry);
        return {...props, state, entries};
    }

    private async readPage(props: CursorPage): Promise<CursorPageResult> {
        const {state, value, key, size} = props;
        // RTDB accepts object values in results but rejects them as query endpoints.
        // Once the boundary is an object, use the original query and filter its tuple.
        if (value !== null && typeof value === "object") {
            const snapshot = await this._readSnapshot(state.initialQuery);
            const children: CursorChildSnapshot[] = [];
            snapshot.forEach(child => {
                const sort = state.byValue ? child.val() : child.child(state.orderBy).val();
                const comparison = compareValues(sort, value) || compareKeys(child.key, key);
                if (state.ascending ? comparison > 0 : comparison < 0) children.push(child);
            });
            if (!state.ascending) children.reverse();
            return {...props, children: children.slice(0, size)};
        }
        props = this.preparePageQuery(props);
        props = await this.fetchPage(props);
        return this.extractChildren(props);
    }

    private preparePageQuery(props: CursorPage): CursorPage {
        const {state, key, value, size} = props;
        const {initialQuery, continuationQuery, ascending, orderBy, byValue} = state;
        const byKey = orderBy === undefined && !byValue;
        let selection = key === undefined ? initialQuery : continuationQuery;
        if (key !== undefined) {
            if (ascending) {
                selection = byKey ? this._query(selection, "startAt", key) : this._query(selection, "startAt", value, key);
            } else {
                selection = byKey ? this._query(selection, "endAt", key) : this._query(selection, "endAt", value, key);
            }
        }
        const limit = key === undefined ? size : size + 1;
        selection = ascending ? this._query(selection, "limitToFirst", limit) : this._query(selection, "limitToLast", limit);
        return {...props, query: selection};
    }

    private async fetchPage(props: CursorPage): Promise<CursorPage> {
        const {query} = props;
        return {...props, snapshot: await this._readSnapshot(query)};
    }

    private extractChildren(props: CursorPage): CursorPageResult {
        const {state, snapshot, key} = props;
        const children: CursorChildSnapshot[] = [];
        snapshot.forEach(child => {
            if (child.key !== key) children.push(child);
        });
        if (!state.ascending) children.reverse();
        return {...props, children};
    }

    private async handleEntry(props: CursorRead): Promise<CursorRead> {
        props = await this.invokeHandle(props);
        props = await this.saveReplacement(props);
        return this.rereadEntry(props);
    }

    private async invokeHandle(props: CursorRead): Promise<CursorRead> {
        const {handle, entry} = props;
        if (!handle || entry === undefined) return props;
        // A handler may mutate its input without requesting a write.
        return {...props, replacement: await handle(structuredClone(entry))};
    }

    private async saveReplacement(props: CursorRead): Promise<CursorRead> {
        const {state, child, replacement} = props;
        if (replacement === undefined) return props;
        const path = state.params
            ? [...state.parentPath, {[state.keyField]: child.key}]
            : state.path ? `${state.path}/${child.key}` : child.key;
        await update(state.backend, path, () => replacement);
        return {...props, entry: undefined};
    }

    private async rereadEntry(props: CursorRead): Promise<CursorRead> {
        const {child, replacement} = props;
        if (replacement === undefined || replacement === null) return props;
        const saved = await this._readSnapshot(child.ref);
        return {...props, entry: saved.exists() && this.hasOrderedField(saved, props.state.orderBy) ? {key: child.key, value: saved.val(), ...(props.state.params ? {params: {...props.state.params}} : {})} : undefined};
    }

    private createCursorQuery(path: DatabasePath, {
        orderBy: rawOrderBy,
        equalTo: equals,
        start,
        end,
        startDate,
        endDate,
        order = DatabaseOrder.ASC
    }: Pick<DatabaseCursorOptions, "orderBy" | "equalTo" | "start" | "end" | "startDate" | "endDate" | "order">): CursorQueryState {
        const orderBy = rawOrderBy === undefined ? undefined : parsePath(rawOrderBy).address;
        const startKey = startDate === undefined ? undefined : key(startDate, "min");
        const endKey = endDate === undefined ? undefined : key(endDate, "max");
        if (typeof start === "string" && end === undefined) {
            end = start + "\uf8ff";
        }
        if (orderBy === undefined && equals === undefined) {
            // Explicit key bounds remain in the query; date bounds also filter the scan.
            if (start === undefined) {
                start = startKey;
            }
            if (end === undefined) {
                end = endKey;
            }
        }
        const reference = this._reference(parsePath(path).address);
        const byValue = orderBy === "" || orderBy === undefined && equals !== undefined;
        let baseQuery;
        if (orderBy !== undefined && orderBy !== "") {
            baseQuery = this._query(reference, "orderByChild", orderBy);
        } else if (byValue) {
            baseQuery = this._query(reference, "orderByValue");
        } else {
            baseQuery = this._query(reference, "orderByKey");
        }
        const ascending = order === DatabaseOrder.ASC;
        let initialQuery = baseQuery;
        let continuationQuery = baseQuery;
        if (equals !== undefined) {
            initialQuery = this._query(baseQuery, "equalTo", equals);
            continuationQuery = ascending ? this._query(baseQuery, "endAt", equals) : this._query(baseQuery, "startAt", equals);
        } else {
            if (start !== undefined) {
                initialQuery = this._query(initialQuery, "startAt", start);
            }
            if (end !== undefined) {
                initialQuery = this._query(initialQuery, "endAt", end);
            }
            if (ascending && end !== undefined) {
                continuationQuery = this._query(continuationQuery, "endAt", end);
            }
            if (!ascending && start !== undefined) {
                continuationQuery = this._query(continuationQuery, "startAt", start);
            }
        }
        return {initialQuery, continuationQuery, ascending, orderBy, byValue, startKey, endKey};
    }
}
