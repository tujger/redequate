import {fail} from "../../../common";
import {DatabaseCursor} from "./DatabaseCursor";
import {DatabaseOrder} from "./DatabaseOrder";

const groupedCursors = new WeakSet();
const headerParents = new WeakMap();
export const normalizePath = path => (path instanceof Array ? path.join("/") : path).split("/").filter(Boolean).join("/");
const isHeader = entry => entry && entry.path === undefined && typeof entry.value?.group === "string";

class ComposedCursor extends DatabaseCursor {
    #state;

    constructor(state) {
        super({id: state.identity.id, group: state.options.group, order: state.options.order});
        this.#state = state;
    }

    get count() { return this.#state.count; }
    get position() { return this.#state.position; }
    next(n) { return next(this.#state, n); }
    subscribe(listener) { return subscribe(this.#state, listener); }
}

export function composeCursor(queries, options, createCursor, run, path = queries, identity) {
    const descriptions = run(() => {
        if (options === null || typeof options !== "object" || options instanceof Array) {
            fail("database/invalid-argument", "options must be an object.");
        }
        if (options.group !== undefined && typeof options.group !== "string") {
            fail("database/invalid-argument", "group must be a string.");
        }
        const {group, ...shared} = options;
        const cursors = new Set();
        return queries.map(description => {
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
            if (individual.group !== undefined && typeof individual.group !== "string") {
                fail("database/invalid-argument", "group must be a string.");
            }
            return {path, options: {...shared, ...individual}};
        });
    }, options, "cursor", {path});
    if (descriptions === undefined) {
        return undefined;
    }

    const state = {
        descriptions, options, run, path, identity,
        grouped: options.group !== undefined || descriptions.some(description => description.options.group !== undefined
            || description.cursor?.group !== undefined || groupedCursors.has(description.cursor)),
        header: options.group === undefined ? [] : [{
            key: path instanceof Array && path.some(part => typeof part === "object") ? identity.id : normalizePath(path),
            value: {group: options.group}
        }],
        seen: new Map(),
        sources: [],
        count: 0,
        buffers: [],
        pending: [],
        turn: 0,
        position: Object.freeze({index: -1, key: undefined, finished: false})
    };
    state.heading = state.header[0];
    const {sources, buffers} = state;
    for (const description of descriptions) {
        const sourceOptions = {
            ...description.options,
            onError: (error, reason, context) => run(() => { throw error; }, description.options, reason, context)
        };
        const source = description.cursor ?? run(() => createCursor(description.path, sourceOptions),
            description.options, "cursor", {path: description.path});
        if (source === undefined) {
            return undefined;
        }
        sources.push(source);
        buffers.push({entries: [], offset: 0, headers: description.options.group === undefined ? []
            : [{key: normalizePath(description.path), value: {group: description.options.group}}]});
    }

    const result = new ComposedCursor(state);
    if (state.grouped) groupedCursors.add(result);
    return result;
}

function subscribe(state, listener) {
    const {sources, descriptions, options, run, path} = state;
    const valid = run(() => {
        if (!(listener instanceof Function)) {
            fail("database/invalid-argument", "listener must be a function.");
        }
        return true;
    }, options, "cursor.subscribe", {path});
    if (!valid) {
        return undefined;
    }
    const subscriptions = [];
    const counters = {add: "added", change: "changed", remove: "removed"};
    const unsubscribe = () => {
        for (const {subscription, description} of subscriptions) {
            run(() => subscription.unsubscribe(), description.options, "cursor.unsubscribe", {path: description.path});
        }
        subscribed.active = false;
    };
    const subscribed = {
        id: state.identity.id,
        subscribed: new Date(),
        active: true,
        added: 0,
        changed: 0,
        removed: 0,
        unsubscribe
    };
    try {
        for (const [index, source] of sources.entries()) {
            const description = descriptions[index];
            const context = {path: description.path};
            const subscription = run(() => source.subscribe(
                event => {
                    subscribed[counters[event.type]]++;
                    state.count += event.type === "add" ? 1 : event.type === "remove" ? -1 : 0;
                    return run(() => listener(event), description.options, "cursor.subscribe", context);
                }
            ), description.options, "cursor.subscribe", context);
            if (subscription === undefined) {
                unsubscribe();
                return undefined;
            }
            subscriptions.push({subscription, description});
        }
    } catch (error) {
        unsubscribe();
        throw error;
    }
    return subscribed;
}

async function next(state, n = 1) {
    const {sources, descriptions, options, run, path} = state;
    const valid = run(() => {
        if (!Number.isSafeInteger(n) || n <= 0) {
            fail("database/invalid-argument", "n must be a positive safe integer.");
        }
        return true;
    }, options, "cursor.next", {path, n});
    if (!valid) {
        return undefined;
    }
    const available = index => state.buffers[index].offset < state.buffers[index].entries.length
        || !sources[index].position.finished;
    const entries = state.pending;
    state.pending = [];
    try {
        while (state.grouped ? state.turn < sources.length
            : entries.length < n && sources.some((_, index) => available(index))) {
            const index = state.turn;
            const source = sources[index];
            const buffer = state.buffers[index];
            if (available(index)) {
                const description = descriptions[index];
                if (buffer.offset === buffer.entries.length) {
                    const batch = await run(async () => {
                        const entries = await source.next(n);
                        if (entries !== undefined && (!(entries instanceof Array) || (source.group === undefined && !groupedCursors.has(source)
                                && entries.filter(entry => !isHeader(entry)).length > n)
                            || (!entries.length && !source.position.finished))) {
                            fail("database/invalid-argument", "Cursor next(n) must return an entry array within its page size, or undefined; an empty result must be finished.");
                        }
                        if (entries?.some(entry => !entry || typeof entry.key !== "string"
                            || !isHeader(entry) && !(typeof entry.path === "string" || entry.path instanceof Array
                                && entry.path.every(part => typeof part === "string")))) {
                            fail("database/invalid-argument", "Cursor entries must have a key and a source collection path.");
                        }
                        return entries;
                    }, description.options,
                        "cursor.next", {path: description.path, n});
                    if (batch === undefined) {
                        state.pending = entries;
                        return undefined;
                    }
                    buffer.entries = batch;
                    buffer.offset = 0;
                }
                do {
                    if (buffer.offset === buffer.entries.length) break;
                    const entry = buffer.entries[buffer.offset++];
                    if (isHeader(entry)) {
                        buffer.headers = buffer.headers.filter(header => {
                            for (let parent = headerParents.get(entry); parent; parent = headerParents.get(parent)) {
                                if (parent === header) return true;
                            }
                            return false;
                        });
                        buffer.headers.push(entry);
                        continue;
                    }
                    const entryPath = normalizePath(entry.path);
                    let keys = state.seen.get(entryPath);
                    if (!keys) {
                        keys = new Set();
                        state.seen.set(entryPath, keys);
                    }
                    if (!keys.has(entry.key)) {
                        keys.add(entry.key);
                        entries.push(...buffer.headers.splice(0), entry);
                    }
                } while (state.grouped);
            }
            state.turn = state.grouped ? state.turn + 1 : (state.turn + 1) % sources.length;
        }
    } catch (error) {
        state.pending = entries;
        throw error;
    }
    if (state.grouped) state.turn = 0;
    const result = entries.splice(0, state.grouped ? entries.length : n);
    if (result.length) result.unshift(...state.header.splice(0));
    if (state.heading) {
        for (const entry of result) {
            if (isHeader(entry) && entry !== state.heading && !headerParents.has(entry)) headerParents.set(entry, state.heading);
        }
    }
    state.pending = entries;
    const finished = !state.pending.length && !sources.some((_, index) => available(index));
    state.position = Object.freeze({
        index: state.position.index + result.length,
        key: result.length ? result[result.length - 1].key : state.position.key,
        finished
    });
    state.count += result.length;
    return result;
}
