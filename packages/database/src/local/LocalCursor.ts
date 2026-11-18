import {
    hasIntermediateWildcard,
    validateCursorPattern,
    expandCursorBranches,
    compareCursorPaths
} from "../common/helpers/cursorPath";
import resolvePath from "../common/helpers/resolvePath";
import compareValues from "../common/helpers/compareValues";
import {fail} from "../../../common";
import DatabaseCursor from "../common/DatabaseCursor";
import type {
    DatabaseCursorEvent, DatabaseCursorOptions, DatabaseCursorPosition, DatabaseCursorSubscription,
    DatabaseEntry, DatabaseGroupEntry, DatabasePath, DatabasePathSegment, DatabaseQueryValue, DatabaseValue
} from "../common/DatabaseTypes";
import type {LocalStorageContext} from "./LocalDatabase";
import compareKeys from "../common/helpers/compareKeys";
import parsePath from "./helpers/parsePath";
import addEventListener from "./addEventListener";
import update from "../common/methods/update";
import {getChildRecordPath, getCursorChildren, getSubtree, getCursorWildcardKeys} from "./helpers/records";

type CursorContext = NonNullable<ConstructorParameters<typeof DatabaseCursor>[2]> & {
    context?: string | LocalStorageContext;
};

type SortKey = {key: string; sort: DatabaseValue};
type Branch = {
    path: DatabasePath;
    keyField?: string;
    params?: DatabaseEntry["params"];
    scan?: SortKey;
};
type OrderedEntry = DatabaseEntry & SortKey;
type Candidate = OrderedEntry & {branch: Branch; fullPath: string};

export default class LocalCursor extends DatabaseCursor {
    #storageId?: CursorContext["context"];
    #path: DatabasePath;
    #identityField?: string;
    #field?: string;
    #byValue: boolean;
    #start?: DatabaseQueryValue;
    #end?: DatabaseQueryValue;
    #startTime?: number;
    #endTime?: number;
    #branches?: Branch[];
    #initializing?: Promise<void>;
    #pattern?: DatabasePath;
    #header: DatabaseGroupEntry[] = [];

    constructor(path: DatabasePath, options: ConstructorParameters<typeof DatabaseCursor>[1] = {},
        {backend, database, context}: CursorContext = {}) {
        const wildcard = hasIntermediateWildcard(path);
        const {keyField: identityField, effectivePath: resolvedPath} = parsePath(path, "collection");
        super(path, options, {backend, database});
        validateCursorPattern(path);
        this.#pattern = wildcard ? path : undefined;
        this.#storageId = context;
        this.#path = resolvedPath;
        this.#identityField = identityField;
        this.#field = this.orderBy === undefined ? undefined : parsePath(this.orderBy).address;
        this.#byValue = this.#field === "" || (this.#field === undefined && this.equalTo !== undefined);
        this.#start = this.start;
        this.#end = this.end === undefined && typeof this.start === "string"
            ? `${this.start}\uf8ff`
            : this.end;
        const dateValue = (value: Date | number) => value instanceof Date ? value.getTime() : value;
        this.#startTime = this.startDate === undefined ? undefined : dateValue(this.startDate);
        this.#endTime = this.endDate === undefined ? undefined : dateValue(this.endDate);
        if ([this.#startTime, this.#endTime].some(value => {
            if (value === undefined) return false;
            return typeof value !== "number" || !Number.isFinite(value);
        })) invalid("Date bounds must be valid dates.");
        if (this.#field === undefined && !this.#byValue) {
            if ((this.#start !== undefined && typeof this.#start !== "string") ||
                (this.#end !== undefined && typeof this.#end !== "string")) invalid("Key range bounds must be strings.");
        }
    }

    override get path(): DatabasePath | undefined {
        const path = super.path;
        if (path === undefined || !this._database || this.#pattern) return path;
        return parsePath(path, "collection").effectivePath;
    }

    override async all(size?: number, checkpoint?: DatabaseCursorPosition | null): Promise<number> {
        return super._all(size, checkpoint, {
            recordPath: (branch, key) => {
                const {effectivePath, keyField} = parsePath(branch, "collection");
                return this.#childRecordPath(effectivePath, key, keyField);
            }
        });
    }

    override async next(n = 1, handle: DatabaseCursorOptions["handle"] | null = this.handle):
        Promise<(DatabaseEntry | DatabaseGroupEntry)[]> {
        this.#header.push(...(await super.next(n, handle))!);
        if (this.position.finished) return [];
        if (!this.#branches) {
            this.#initializing ??= this.#initialize().catch(error => {
                this.#initializing = undefined;
                throw error;
            });
            await this.#initializing;
        }
        const candidates: Candidate[] = [];
        for (const branch of this.#branches!) {
            for (const candidate of this.#entries(await this.#read(branch))) {
                if (branch.scan && this.#compare(candidate, branch.scan) <= 0) continue;
                candidates.push({
                    ...candidate,
                    branch,
                    fullPath: [resolvePath(branch.path), candidate.key].filter(Boolean).join("/")
                });
            }
        }
        candidates.sort((a, b) => this.#compareCandidates(a, b));
        const result: DatabaseEntry[] = [];
        while (candidates.length && result.length < n) {
            const candidate = candidates.shift()!;
            const {key, value, branch} = candidate;
            let entry: DatabaseEntry | undefined = {key, value, ...(branch.params ? {params: {...branch.params}} : {})};
            if (handle) {
                const replacement = await handle(structuredClone(entry));
                if (replacement !== undefined) {
                    const recordPath = await this.#childRecordPath(branch.path, key, branch.keyField);
                    await update(this._backend, recordPath, () => replacement);
                    if (replacement === null) entry = undefined;
                    else {
                        const saved: DatabaseValue | undefined = branch.path.length
                            ? await getSubtree(this.#storageId, recordPath)
                            : (await this.#read(branch) as Record<string, DatabaseValue>)[key];
                        if (saved === undefined || !this.#hasField(saved)) entry = undefined;
                        else entry = {...entry, value: saved};
                    }
                }
            }
            branch.scan = {key, sort: candidate.sort};
            if (entry) result.push(entry);
        }
        const page = [...this.#header.splice(0), ...result];
        this._position = Object.freeze({
            index: this.position.index + page.length,
            key: page.at(-1)?.key ?? this.position.key,
            finished: result.length < n && !candidates.length
        });
        this._count += page.length;
        return page;
    }

    override subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription {
        super.subscribe(listener);
        if (this.#pattern) invalid("Subscriptions to intermediate cursor wildcards are not supported.");
        const cursor = this;
        const subscription = {
            id: this.id,
            subscribed: new Date(),
            active: true,
            added: 0,
            changed: 0,
            removed: 0,
            unsubscribe: () => {
                if (!subscription.active) return;
                subscription.active = false;
                registration.remove();
            }
        };
        let previous: Map<string, DatabaseValue> | undefined;
        const notify = (event: DatabaseCursorEvent) => {
            if (!subscription.active) return;
            this._started = true;
            subscription[{add: "added", change: "changed", remove: "removed"}[event.type]]++;
            cursor._count += {add: 1, change: 0, remove: -1}[event.type];
            listener(event);
        };
        const registration = addEventListener(this.#storageId, this.#path, {
            onChange: (value: DatabaseValue | undefined) => {
                const current = new Map(this.#entries(value).map(({key, value}) => [key, value]));
                if (previous !== undefined) {
                    for (const [key, value] of previous) {
                        if (!current.has(key)) notify({type: "remove", entry: {key, value}});
                    }
                    for (const [key, value] of current) {
                        if (!previous.has(key)) notify({type: "add", entry: {key, value}});
                        else if (!equal(previous.get(key), value)) notify({type: "change", entry: {key, value}});
                    }
                }
                previous = current;
            },
            onError: (error: unknown) => this.onError?.(error, "cursor.subscribe", {path: this.path})
        }, () => this.#read());
        return subscription;
    }

    #childRecordPath(path: DatabasePath, key: string, keyField?: string): DatabasePath | Promise<DatabasePath> {
        if (!path.length) return [key];
        return getChildRecordPath(this.#storageId, path, key, keyField);
    }

    #sortValue(key: string, value: DatabaseValue): DatabaseValue {
        if (this.#field === undefined && !this.#byValue) return key;
        if (this.#byValue) return value;
        return this.#field.split("/").reduce<DatabaseValue | undefined>((node, name) => {
            if (node === null || typeof node !== "object") return undefined;
            return (node as Record<string, DatabaseValue>)[name];
        }, value) ?? null;
    }

    async #read(branch: Pick<Branch, "path" | "keyField"> = {path: this.#path, keyField: this.#identityField}):
        Promise<DatabaseValue | undefined> {
        if (branch.keyField !== undefined) {
            return getCursorChildren(this.#storageId, branch.path, branch.keyField, {
                orderBy: this.orderBy, equalTo: this.equalTo, start: this.start, end: this.end
            });
        }
        return getSubtree(this.#storageId, branch.path, {
            orderBy: this.orderBy, equalTo: this.equalTo, start: this.start, end: this.end
        });
    }

    #hasField(value: DatabaseValue): boolean {
        if (!this.#field) return true;
        const field = this.#field.split("/").reduce<DatabaseValue | undefined>((node, name) => {
            if (node === null || typeof node !== "object") return undefined;
            return (node as Record<string, DatabaseValue>)[name];
        }, value);
        return field != null;
    }

    #inDateRange(value: DatabaseValue): boolean {
        if (this.#startTime === undefined && this.#endTime === undefined) return true;
        const stored = (value as {timestamp?: unknown} | null)?.timestamp;
        const timestamp = stored instanceof Date ? stored.getTime() : stored;
        if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
        if (this.#startTime !== undefined && timestamp < this.#startTime) return false;
        if (this.#endTime !== undefined && timestamp > this.#endTime) return false;
        return true;
    }

    #compare(left: SortKey, right: SortKey): number {
        const byKey = this.#field === undefined && !this.#byValue;
        let result;
        if (byKey) {
            result = compareKeys(left.sort, right.sort);
        } else {
            result = compareValues(left.sort, right.sort);
            if (!result) result = compareKeys(left.key, right.key);
        }
        const direction = this.order === "desc" ? -1 : 1;
        return result * direction;
    }

    #entries(value?: DatabaseValue): OrderedEntry[] {
        const byKey = this.#field === undefined && !this.#byValue;
        return children(value).map(([key, item]) => ({key, value: item, sort: this.#sortValue(key, item)}))
            .filter(({key, value: item, sort}) => {
                if (!this.#inDateRange(item)) return false;
                if (!this.#hasField(item)) return false;
                const compare = byKey ? compareKeys : compareValues;
                if (this.equalTo !== undefined && !Object.is(sort, this.equalTo)) return false;
                if (this.#start !== undefined && !(compare(sort, this.#start) >= 0)) return false;
                if (this.#end !== undefined && !(compare(sort, this.#end) <= 0)) return false;
                return true;
            }).sort((a, b) => this.#compare(a, b));
    }

    async #initialize(): Promise<void> {
        const branches: Pick<Branch, "path" | "params">[] = this.#pattern
            ? await expandCursorBranches(this.#pattern, (path: DatabasePathSegment[], field: string) =>
                getCursorWildcardKeys(this.#storageId, path, field))
            : [{path: this.path!}];
        this.#branches = branches.map(({path, params}) => {
            const parsed = params ? parsePath(path, "collection") : {
                effectivePath: this.#path,
                keyField: this.#identityField
            };
            return {path: parsed.effectivePath, keyField: parsed.keyField, params, scan: undefined};
        });
    }

    #compareCandidates(a: Candidate, b: Candidate): number {
        if (!this.#pattern) return this.#compare(a, b);
        const byKey = this.#field === undefined && !this.#byValue;
        const compared = byKey ? compareKeys(a.sort, b.sort) : compareValues(a.sort, b.sort);
        return (compared || compareCursorPaths(a.fullPath, b.fullPath)) * (this.order === "desc" ? -1 : 1);
    }
}

const invalid = (message: string) => fail("database/invalid-argument", message);
const equal = (left: DatabaseValue, right: DatabaseValue) => JSON.stringify(left) === JSON.stringify(right);
const children = (value?: DatabaseValue): [string, DatabaseValue][] => value !== null && typeof value === "object" ? Object.entries(value) : [];
