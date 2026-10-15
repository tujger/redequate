import {fail} from "../../common/src/_packages";

export function composeCursor(paths, options, createCursor, run) {
    const descriptions = run(() => {
        if (options === null || typeof options !== "object" || Array.isArray(options)) {
            fail("database/invalid-argument", "options must be an object.");
        }
        return paths.map(description => {
            if (description === null || typeof description !== "object" || Array.isArray(description)) {
                fail("database/invalid-argument", "Each cursor source must be an object with a path.");
            }
            const {path, ...individual} = description;
            if (typeof path !== "string" && !(Array.isArray(path) && path.every(part => typeof part === "string"))) {
                fail("database/invalid-argument", "A cursor source path must be a string or string array.");
            }
            return {path, options: {...options, ...individual}};
        });
    }, "cursor", {});
    if (descriptions === undefined) {
        return undefined;
    }

    const seen = new Map();
    const sources = [];
    let readSize = 1;
    for (const description of descriptions) {
        const path = (Array.isArray(description.path) ? description.path.join("/") : description.path)
            .split("/").filter(Boolean).join("/");
        if (!seen.has(path)) {
            seen.set(path, new Set());
        }
        const keys = seen.get(path);
        const source = createCursor(description.path, description.options, {
            readSize: () => readSize,
            accept: key => !keys.has(key),
            processed: key => keys.add(key)
        });
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
            }, "cursor.next", {n});
            if (!valid) {
                return undefined;
            }
            readSize = n;
            if (sources.length === 1) {
                return sources[0].next(n);
            }
            const entries = [];
            while (entries.length < n && !sources.every(source => source.position.finished)) {
                const source = sources[turn];
                if (!source.position.finished) {
                    const batch = await source.next(1);
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
            for (const source of sources) {
                source.reset();
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
