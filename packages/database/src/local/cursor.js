import {hasIntermediateWildcard, validateCursorPattern, expandCursorBranches, compareCursorPaths} from "../common/cursorPath";
import resolvePath from "../common/resolvePath";
import compareValues from "../common/compareValues";
import {fail} from "../../../common";
import DatabaseCursor from "../common/DatabaseCursor";
import compareKeys from "../common/compareKeys";
import parsePath from "./parsePath";
import addEventListener from "./addEventListener";
import update from "../common/methods/update";
import {getChildRecordPath, getCursorChildren, getSubtree, getCursorWildcardKeys} from "./helpers";

const invalid = message => fail("database/invalid-argument", message);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const children = value => value !== null && typeof value === "object" ? Object.entries(value) : [];

export default class LocalCursor extends DatabaseCursor {
    #storageId;
    #backend;
    #path;
    #identityField;
    #field;
    #byValue;
    #start;
    #end;
    #startTime;
    #endTime;
    #branches;
    #initializing;
    #pattern;
    #header = [];

    constructor(storageId, path, options = {}, backend) {
        const wildcard = hasIntermediateWildcard(path);
        const {keyField: identityField, effectivePath: resolvedPath} = parsePath(path, "collection");
        super(options, wildcard ? path : resolvedPath);
        validateCursorPattern(path);
        this.#pattern = wildcard ? path : undefined;
        this.#storageId = storageId;
        this.#backend = backend;
        this.#path = resolvedPath;
        this.#identityField = identityField;
        this.#field = this.orderBy === undefined ? undefined : parsePath(this.orderBy).address;
        this.#byValue = this.#field === "" || (this.#field === undefined && this.equalTo !== undefined);
        this.#start = this.start;
        this.#end = this.end === undefined && typeof this.start === "string"
            ? `${this.start}\uf8ff`
            : this.end;
        const dateValue = value => value instanceof Date ? value.getTime() : value;
        this.#startTime = this.startDate === undefined ? undefined : dateValue(this.startDate);
        this.#endTime = this.endDate === undefined ? undefined : dateValue(this.endDate);
        if ([this.#startTime, this.#endTime].some(value => value !== undefined &&
            (typeof value !== "number" || !Number.isFinite(value)))) invalid("Date bounds must be valid dates.");
        if (this.#field === undefined && !this.#byValue) {
            if ((this.#start !== undefined && typeof this.#start !== "string") ||
                (this.#end !== undefined && typeof this.#end !== "string")) invalid("Key range bounds must be strings.");
        }
    }

    #sortValue(key, value) {
        if (this.#field === undefined && !this.#byValue) return key;
        if (this.#byValue) return value;
        return this.#field.split("/").reduce((node, name) => node !== null &&
            typeof node === "object"
            ? node[name]
            : undefined, value) ?? null;
    }

    async #read(branch = {path: this.#path, keyField: this.#identityField}) {
        if (branch.keyField !== undefined) return getCursorChildren(this.#storageId, branch.path, branch.keyField, {
            orderBy: this.orderBy, equalTo: this.equalTo, start: this.start, end: this.end
        });
        return getSubtree(this.#storageId, branch.path, {
            orderBy: this.orderBy, equalTo: this.equalTo, start: this.start, end: this.end
        });
    }

    #hasField(value) {
        return !this.#field || this.#field.split("/").reduce((node, name) => node !== null &&
            typeof node === "object"
            ? node[name]
            : undefined, value) != null;
    }

    #inDateRange(value) {
        if (this.#startTime === undefined && this.#endTime === undefined) return true;
        const timestamp = value?.timestamp instanceof Date ? value.timestamp.getTime() : value?.timestamp;
        return typeof timestamp === "number" && Number.isFinite(timestamp) &&
            (this.#startTime === undefined || timestamp >= this.#startTime) &&
            (this.#endTime === undefined || timestamp <= this.#endTime);
    }

    #compare(left, right) {
        const byKey = this.#field === undefined && !this.#byValue;
        return (byKey
            ? compareKeys(left.sort, right.sort)
            : compareValues(left.sort, right.sort) || compareKeys(left.key, right.key)) *
            (this.order === "desc" ? -1 : 1);
    }

    #entries(value) {
        const byKey = this.#field === undefined && !this.#byValue;
        return children(value).map(([key, item]) => ({key, value: item, sort: this.#sortValue(key, item)}))
            .filter(({key, value: item, sort}) => {
                if (!this.#inDateRange(item)) return false;
                if (!this.#hasField(item)) return false;
                const compare = byKey ? compareKeys : compareValues;
                return (this.equalTo === undefined || Object.is(sort, this.equalTo)) &&
                    (this.#start === undefined || compare(sort, this.#start) >= 0) &&
                    (this.#end === undefined || compare(sort, this.#end) <= 0);
            }).sort((a, b) => this.#compare(a, b));
    }

    async #initialize() {
        const branches = this.#pattern
            ? await expandCursorBranches(this.#pattern, (path, field) => getCursorWildcardKeys(this.#storageId, path, field))
            : [{path: this.path}];
        this.#branches = branches.map(({path, params}) => {
            const parsed = params ? parsePath(path, "collection") : {effectivePath: this.#path, keyField: this.#identityField};
            return {path: parsed.effectivePath, keyField: parsed.keyField, params, scan: undefined};
        });
    }

    #compareCandidates(a, b) {
        if (!this.#pattern) return this.#compare(a, b);
        const byKey = this.#field === undefined && !this.#byValue;
        const compared = byKey ? compareKeys(a.sort, b.sort) : compareValues(a.sort, b.sort);
        return (compared || compareCursorPaths(a.fullPath, b.fullPath)) * (this.order === "desc" ? -1 : 1);
    }

    async next(n = 1) {
        this.#header.push(...await super.next(n));
        if (this.position.finished) return [];
        if (!this.#branches) {
            this.#initializing ??= this.#initialize().catch(error => { this.#initializing = undefined; throw error; });
            await this.#initializing;
        }
        const candidates = [];
        for (const branch of this.#branches) {
            for (const candidate of this.#entries(await this.#read(branch))) {
                if (branch.scan && this.#compare(candidate, branch.scan) <= 0) continue;
                candidates.push({...candidate, branch, fullPath: [resolvePath(branch.path), candidate.key].filter(Boolean).join("/")});
            }
        }
        candidates.sort((a, b) => this.#compareCandidates(a, b));
        const result = [];
        while (candidates.length && result.length < n) {
            const candidate = candidates.shift();
            const {key, value, branch} = candidate;
            let entry = {key, value, ...(branch.params ? {params: {...branch.params}} : {})};
            if (this.handle) {
                const replacement = await this.handle(structuredClone(entry));
                if (replacement !== undefined) {
                    const recordPath = branch.path.length
                        ? await getChildRecordPath(this.#storageId, branch.path, key, branch.keyField) : [key];
                    await update(this.#backend, recordPath, () => replacement);
                    if (replacement === null) entry = undefined;
                    else {
                        const saved = branch.path.length ? await getSubtree(this.#storageId, recordPath) : (await this.#read(branch))[key];
                        entry = saved === undefined || !this.#hasField(saved) ? undefined : {...entry, value: saved};
                    }
                }
            }
            branch.scan = {key, sort: candidate.sort};
            if (entry) result.push(entry);
        }
        const page = [...this.#header.splice(0), ...result];
        this._position = Object.freeze({index: this.position.index + page.length,
            key: page.at(-1)?.key ?? this.position.key,
            finished: result.length < n && !candidates.length});
        this._count += page.length;
        return page;
    }

    subscribe(listener) {
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
        let previous;
        const notify = event => {
            if (!subscription.active) return;
            this._started = true;
            subscription[event.type === "add" ? "added" : event.type === "change" ? "changed" : "removed"]++;
            cursor._count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
            listener(event);
        };
        const registration = addEventListener(this.#storageId, this.#path, {
            onChange: value => {
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
            onError: error => this.onError?.(error, "cursor.subscribe", {path: this.path})
        }, () => this.#read());
        return subscription;
    }
}
