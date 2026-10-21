import {fail} from "../../../common";
import {DatabaseCursor} from "../common/DatabaseCursor";
import compareKeys from "../common/compareKeys";
import resolvePath from "../common/resolvePath";
import addEventListener, {mutate} from "./addEventListener";
import {createRecordPath, getAllRecords, getChildRecordPath, getSubtree, parseDatabasePath, replaceIndexedRecord, subtreeValue, updateRecords} from "./helpers";
import {LOCAL_COLLECTIONS} from "./constants";
import {canUseIndex, readIndexedPage, recordPath as indexedRecordPath, scopeKey} from "./cursorIndex";

const invalid = message => fail("database/invalid-argument", message);
const rank = value => value === null
    ? 0
    : typeof value === "boolean"
        ? 1
        : typeof value === "number" ? 2 : typeof value === "string" ? 3 : 4;
const compareValue = (left, right) => rank(left) - rank(right) ||
    (left < right ? -1 : left > right ? 1 : 0);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const children = value => value !== null && typeof value === "object" ? Object.entries(value) : [];

export default class LocalCursor extends DatabaseCursor {
    #storageKey;
    #path;
    #field;
    #byValue;
    #start;
    #end;
    #startTime;
    #endTime;
    #scan;
    #seen = new Set();
    #header = [];
    #indexed;
    #nativeScan;

    constructor(storageKey, path, options = {}) {
        super(options, path);
        this.#storageKey = storageKey;
        this.#path = typeof path === "string" ? path.split("/").filter(Boolean) : path;
        this.#field = this.orderBy === undefined ? undefined : resolvePath(this.orderBy);
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

    async #read() {
        if (this.#path.length) return getSubtree(this.#storageKey, this.#path);
        const rows = await getAllRecords(this.#storageKey);
        return Object.fromEntries([...new Set(rows.map(row => row._collection))]
            .map(collection => [collection, subtreeValue(rows, [collection])]));
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
            : compareValue(left.sort, right.sort) || compareKeys(left.key, right.key)) *
            (this.order === "desc" ? -1 : 1);
    }

    #entries(value) {
        const byKey = this.#field === undefined && !this.#byValue;
        return children(value).map(([key, item]) => ({key, value: item, sort: this.#sortValue(key, item)}))
            .filter(({key, value: item, sort}) => {
                if (!this.#inDateRange(item)) return false;
                if (!this.#hasField(item)) return false;
                const compare = byKey ? compareKeys : compareValue;
                return (this.equalTo === undefined || Object.is(sort, this.equalTo)) &&
                    (this.#start === undefined || compare(sort, this.#start) >= 0) &&
                    (this.#end === undefined || compare(sort, this.#end) <= 0);
            }).sort((a, b) => this.#compare(a, b));
    }

    async next(n = 1) {
        this.#header.push(...await super.next(n));
        if (this.position.finished) return [];
        const collection = this.#path[0];
        const indexedField = ["created", "timestamp", "to", "name", "email", "_sort_name", "type", "uid", "id"].includes(this.#field)
            ? this.#field
            : this.#field === undefined && !this.#byValue
                ? "key"
                : undefined;
        const scope = this.#path.length === 2
            ? scopeKey(parseDatabasePath(this.#path, {allowField: false}))
            : undefined;
        if (this.#indexed === undefined) {
            this.#indexed = [1, 2].includes(this.#path.length) && indexedField !== undefined &&
                await canUseIndex(this.#storageKey, collection, indexedField, scope);
        }
        if (this.#indexed && !await canUseIndex(this.#storageKey, collection, indexedField, scope)) this.#indexed = false;
        const candidates = this.#indexed ? [] : this.#entries(await this.#read());
        const result = [];
        let exhausted = false;
        while (result.length < n) {
            if (this.#indexed) {
                let start = this.equalTo ?? this.#start;
                let end = this.equalTo ?? this.#end;
                if (indexedField === "timestamp") {
                    if (this.#startTime !== undefined && (start === undefined || typeof start === "number" && start < this.#startTime)) start = this.#startTime;
                    if (this.#endTime !== undefined && (end === undefined || typeof end === "number" && end > this.#endTime)) end = this.#endTime;
                }
                const page = await readIndexedPage(this.#storageKey, collection, indexedField,
                    {
                        order: this.order,
                        start,
                        end,
                        scope
                    }, this.#nativeScan, n - result.length);
                candidates.push(...page.rows.map(row => ({...row, sort: this.#sortValue(row.key, row.value)})));
                exhausted = page.exhausted;
                if (page.last) this.#nativeScan = page.last;
            }
            if (!candidates.length) {
                if (this.#indexed && !exhausted) continue;
                break;
            }
            while (candidates.length && result.length < n) {
                const candidate = candidates.shift();
                if (this.#scan && this.#compare(candidate, this.#scan) <= 0) continue;
                if (this.#seen.has(candidate.key)) continue;
                const {key, value} = candidate;
                if (!this.#hasField(value) || !this.#inDateRange(value)) {
                    this.#scan = {key, sort: candidate.sort};
                    this.#seen.add(key);
                    continue;
                }
                let entry = {key, value};
                if (this.handle) {
                    const replacement = await this.handle(structuredClone(entry));
                    if (replacement !== undefined) {
                        const field = LOCAL_COLLECTIONS[collection]?.idField ?? "id";
                        const recordPath = this.#indexed
                            ? indexedRecordPath(collection, candidate.pathKey)
                            : this.#path.length
                                ? await getChildRecordPath(this.#storageKey, this.#path, key) ??
                            createRecordPath([...this.#path, field], key)
                                : [key];
                        const savedValue = await mutate(this.#storageKey, [recordPath], () => this.#indexed
                            ? replaceIndexedRecord(this.#storageKey, recordPath, candidate.pathKey, replacement)
                            : updateRecords(this.#storageKey, [[recordPath, replacement]]));
                        if (replacement === null) entry = undefined;
                        else {
                            const saved = this.#indexed
                                ? savedValue
                                : this.#path.length
                                    ? await getSubtree(this.#storageKey, recordPath)
                                    : (await this.#read())[key];
                            entry = saved === undefined || !this.#hasField(saved)
                                ? undefined
                                : {key, value: saved};
                        }
                    }
                }
                this.#scan = {key, sort: candidate.sort};
                this.#seen.add(key);
                if (entry) result.push(entry);
            }
            if (!this.#indexed || exhausted) break;
        }
        const page = [...this.#header.splice(0), ...result];
        this._position = Object.freeze({
            index: this.position.index + page.length,
            key: page.length ? page.at(-1).key : this.position.key,
            finished: this.#indexed
                ? exhausted && !candidates.length
                : result.length < n && !candidates.some(candidate =>
                    !this.#seen.has(candidate.key) && this.#compare(candidate, this.#scan) > 0)
        });
        this._count += page.length;
        return page;
    }

    subscribe(listener) {
        super.subscribe(listener);
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
        const registration = addEventListener(this.#storageKey, this.#path, {
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
