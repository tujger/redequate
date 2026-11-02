import DatabaseCursor from "./DatabaseCursor";
import type {DatabaseEntry, DatabaseGroupEntry, DatabaseCursorEvent, DatabaseCursorSubscription} from "./DatabaseTypes";

type Entry = DatabaseEntry | DatabaseGroupEntry;

/** Filters a fresh cursor's delivered entries without changing its query or source-owned handle. */
export default class FilteringDatabaseCursor extends DatabaseCursor {
    readonly #source: DatabaseCursor;
    readonly #matches: (entry: DatabaseEntry) => boolean;
    #pending: Entry[] = [];
    readonly #included = new Set<string>();

    constructor(source: DatabaseCursor, matches: (entry: DatabaseEntry) => boolean) {
        if (!(source instanceof DatabaseCursor) || !(matches instanceof Function)) {
            throw new TypeError("FilteringDatabaseCursor requires a cursor and a predicate.");
        }
        super();
        FilteringDatabaseCursor._assertFresh(source);
        this.#source = source;
        this.#matches = matches;
    }

    get path() { return this.#source.path; }
    get group() { return this.#source.group; }
    get order() { return this.#source.order; }
    get orderBy() { return this.#source.orderBy; }
    get equalTo() { return this.#source.equalTo; }
    get start() { return this.#source.start; }
    get end() { return this.#source.end; }
    get startDate() { return this.#source.startDate; }
    get endDate() { return this.#source.endDate; }
    get onError() { return this.#source.onError; }
    get handle(): never {
        throw new Error("FilteringDatabaseCursor does not support handle.");
    }

    async next(n = 1): Promise<Entry[] | undefined> {
        // Validate n with the same base contract, without creating a second heading.
        await super.next(n);
        const result: Entry[] = [];
        while (result.length < n) {
            if (this.#pending.length) {
                const entry = this.#pending.shift()!;
                result.push(entry);
                if ("value" in entry) this.#included.add(entry.key);
                continue;
            }
            if (this.#source.position.finished) break;
            const batch = await this.#source.next(n - result.length);
            if (batch === undefined) {
                this.#pending.unshift(...result);
                return undefined;
            }
            if (!batch.length && !this.#source.position.finished) {
                throw new Error("Source cursor returned an empty unfinished page.");
            }
            this.#pending.push(...batch.filter(entry => !("value" in entry) || this.#matches(entry as DatabaseEntry)));
        }
        this._position = Object.freeze({
            index: this.position.index + result.length,
            key: result.length ? result.at(-1)!.key : this.position.key,
            finished: !this.#pending.length && this.#source.position.finished
        });
        this._count += result.length;
        return result;
    }

    subscribe(listener: (event: DatabaseCursorEvent) => void): DatabaseCursorSubscription | undefined {
        super.subscribe(listener);
        const sourceSubscription = this.#source.subscribe(event => {
            const matches = this.#matches(event.entry);
            const wasIncluded = this.#included.has(event.entry.key);
            if (event.type === "remove" || !matches) this.#included.delete(event.entry.key);
            else this.#included.add(event.entry.key);
            if (event.type === "remove" && !wasIncluded && !matches) return;
            if (!matches && !wasIncluded) return;
            const type = event.type === "remove" || !matches
                ? "remove"
                : event.type === "change" && !wasIncluded ? "change" : event.type;
            this._count += type === "add" ? 1 : type === "remove" ? -1 : 0;
            listener({...event, type});
        });
        if (!sourceSubscription) return undefined;
        return sourceSubscription;
    }
}
