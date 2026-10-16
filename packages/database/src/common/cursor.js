import {fail} from "../../../common";

export function composeCursor(queries, options, createCursor, run, path = queries, identity) {
    const descriptions = run(() => {
        if (options === null || typeof options !== "object" || options instanceof Array) {
            fail("database/invalid-argument", "options must be an object.");
        }
        return queries.map(description => {
            if (description === null || typeof description !== "object" || description instanceof Array) {
                fail("database/invalid-argument", "Each cursor source must be an object with a path.");
            }
            const {path, ...individual} = description;
            if (typeof path !== "string" && !(path instanceof Array && path.every(part => typeof part === "string"))) {
                fail("database/invalid-argument", "A cursor source path must be a string or string array.");
            }
            return {path, options: {...options, ...individual}};
        });
    }, options, "cursor", {path});
    if (descriptions === undefined) {
        return undefined;
    }

    const state = {
        descriptions, options, run, path, identity,
        seen: new Map(),
        sources: [],
        readSize: 1,
        turn: 0,
        position: Object.freeze({index: -1, key: undefined, finished: false})
    };
    const {seen, sources} = state;
    for (const description of descriptions) {
        const tracking = {readSize: () => state.readSize};
        if (descriptions.length > 1) {
            const path = (description.path instanceof Array ? description.path.join("/") : description.path)
                .split("/").filter(Boolean).join("/");
            if (!seen.has(path)) {
                seen.set(path, new Set());
            }
            const keys = seen.get(path);
            tracking.accept = key => !keys.has(key);
            tracking.processed = key => keys.add(key);
        }
        const sourceOptions = {
            ...description.options,
            onError: (error, reason, context) => run(() => { throw error; }, description.options, reason, context)
        };
        const source = run(() => createCursor(description.path, sourceOptions, tracking),
            description.options, "cursor", {path: description.path});
        if (source === undefined) {
            return undefined;
        }
        sources.push(source);
    }

    return {
        subscribe: subscribe.bind(null, state),
        get position() {
            return sources.length === 1 ? sources[0].position : state.position;
        },
        next: next.bind(null, state),
        reset: reset.bind(null, state)
    };
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
    state.readSize = n;
    if (sources.length === 1) {
        return run(() => sources[0].next(n), descriptions[0].options,
            "cursor.next", {path: descriptions[0].path, n});
    }
    const entries = [];
    while (entries.length < n && !sources.every(source => source.position.finished)) {
        const source = sources[state.turn];
        if (!source.position.finished) {
            const description = descriptions[state.turn];
            const batch = await run(() => source.next(1), description.options,
                "cursor.next", {path: description.path, n: 1});
            if (batch === undefined) {
                return undefined;
            }
            for (const entry of batch) {
                entries.push(entry);
                state.position = Object.freeze({index: state.position.index + 1, key: entry.key, finished: false});
            }
        }
        state.turn = (state.turn + 1) % sources.length;
    }
    if (sources.every(source => source.position.finished)) {
        state.position = Object.freeze({...state.position, finished: true});
    }
    return entries;
}

function reset(state) {
    const {sources, descriptions, seen, run} = state;
    for (const [index, source] of sources.entries()) {
        const description = descriptions[index];
        run(() => source.reset(), description.options, "cursor.reset", {path: description.path});
    }
    for (const keys of seen.values()) {
        keys.clear();
    }
    state.turn = 0;
    state.readSize = 1;
    state.position = Object.freeze({index: -1, key: undefined, finished: false});
}
