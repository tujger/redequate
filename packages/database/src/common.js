import {fail} from "../../common/src/_packages";

export function composeCursor(queries, options, createCursor, run, path = queries) {
    const descriptions = run(() => {
        if (options === null || typeof options !== "object" || Array.isArray(options)) {
            fail("database/invalid-argument", "options must be an object.");
        }
        return queries.map(description => {
            if (description === null || typeof description !== "object" || Array.isArray(description)) {
                fail("database/invalid-argument", "Each cursor source must be an object with a path.");
            }
            const {path, ...individual} = description;
            if (typeof path !== "string" && !(Array.isArray(path) && path.every(part => typeof part === "string"))) {
                fail("database/invalid-argument", "A cursor source path must be a string or string array.");
            }
            return {path, options: {...options, ...individual}};
        });
    }, options, "cursor", {path});
    if (descriptions === undefined) {
        return undefined;
    }

    const seen = new Map();
    const sources = [];
    let readSize = 1;
    for (const description of descriptions) {
        const tracking = {readSize: () => readSize};
        if (descriptions.length > 1) {
            const path = (Array.isArray(description.path) ? description.path.join("/") : description.path)
                .split("/").filter(Boolean).join("/");
            if (!seen.has(path)) {
                seen.set(path, new Set());
            }
            const keys = seen.get(path);
            tracking.accept = key => !keys.has(key);
            tracking.processed = key => keys.add(key);
        }
        const source = run(() => createCursor(description.path, description.options, tracking),
            description.options, "cursor", {path: description.path});
        if (source === undefined) {
            return undefined;
        }
        sources.push(source);
    }

    let turn = 0;
    let position = Object.freeze({index: -1, key: undefined, finished: false});

    return {
        get position() {
            return sources.length === 1 ? sources[0].position : position;
        },
        async next(n = 1) {
            const valid = run(() => {
                if (!Number.isSafeInteger(n) || n <= 0) {
                    fail("database/invalid-argument", "n must be a positive safe integer.");
                }
                return true;
            }, options, "cursor.next", {path, n});
            if (!valid) {
                return undefined;
            }
            readSize = n;
            if (sources.length === 1) {
                return run(() => sources[0].next(n), descriptions[0].options,
                    "cursor.next", {path: descriptions[0].path, n});
            }
            const entries = [];
            while (entries.length < n && !sources.every(source => source.position.finished)) {
                const source = sources[turn];
                if (!source.position.finished) {
                    const description = descriptions[turn];
                    const batch = await run(() => source.next(1), description.options,
                        "cursor.next", {path: description.path, n: 1});
                    if (batch === undefined) {
                        return undefined;
                    }
                    for (const entry of batch) {
                        entries.push(entry);
                        position = Object.freeze({index: position.index + 1, key: entry.key, finished: false});
                    }
                }
                turn = (turn + 1) % sources.length;
            }
            if (sources.every(source => source.position.finished)) {
                position = Object.freeze({...position, finished: true});
            }
            return entries;
        },
        reset() {
            for (const [index, source] of sources.entries()) {
                const description = descriptions[index];
                run(() => source.reset(), description.options, "cursor.reset", {path: description.path});
            }
            for (const keys of seen.values()) {
                keys.clear();
            }
            turn = 0;
            readSize = 1;
            position = Object.freeze({index: -1, key: undefined, finished: false});
        }
    };
}
