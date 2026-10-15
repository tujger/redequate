import {fail} from "../../../common/src/_packages";
import createCursorQuery from "./createCursorQuery";

export default function cursor(firebase, path, options = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        fail("database/invalid-argument", "options must be an object.");
    }
    const {handle} = options;
    if (handle !== undefined && typeof handle !== "function") {
        fail("database/invalid-argument", "handle must be a function or undefined.");
    }
    let position = Object.freeze({index: -1, key: undefined, finished: false});
    let cursorValue;

    const {initialQuery, continuationQuery, ascending, orderBy, startKey, endKey} = createCursorQuery(firebase, path, options);

    const readPage = async (key, value, size) => {
        let query = key === undefined ? initialQuery : continuationQuery;
        if (key !== undefined) {
            if (ascending) {
                query = orderBy === undefined ? query.startAfter(key) : query.startAfter(value, key);
            } else {
                query = orderBy === undefined ? query.endBefore(key) : query.endBefore(value, key);
            }
        }
        query = ascending ? query.limitToFirst(size) : query.limitToLast(size);
        const snapshot = await query.once("value");
        const children = [];
        snapshot.forEach(child => {
            children.push(child);
        });
        if (!ascending) {
            children.reverse();
        }
        return children;
    };

    const handleEntry = async child => {
        const entry = {key: child.key, value: child.val()};
        if (!handle) {
            return entry;
        }
        // A handler may mutate its input without requesting a write.
        const replacement = await handle(structuredClone(entry));
        if (replacement === undefined) {
            return entry;
        }
        await child.ref.set(replacement);
        if (replacement === null) {
            return undefined;
        }
        const saved = await child.ref.once("value");
        if (!saved.exists()) {
            return undefined;
        }
        return {key: child.key, value: saved.val()};
    };

    const reset = () => {
        position = Object.freeze({index: -1, key: undefined, finished: false});
        cursorValue = undefined;
    };

    return {
        get position() {
            return position;
        },
        async next(n = 1) {
            if (!Number.isSafeInteger(n) || n <= 0) {
                fail("database/invalid-argument", "n must be a positive safe integer.");
            }
            if (position.finished) {
                return [];
            }

            const entries = [];
            let scanKey = position.key;
            let scanValue = cursorValue;
            while (entries.length < n) {
                const remaining = n - entries.length;
                const children = await readPage(scanKey, scanValue, remaining);
                for (const child of children) {
                    const sortValue = orderBy === undefined ? child.key : child.child(orderBy).val();
                    if ((startKey !== undefined && child.key < startKey) || (endKey !== undefined && child.key > endKey)) {
                        scanKey = child.key;
                        scanValue = sortValue;
                        continue;
                    }
                    const entry = await handleEntry(child);
                    scanKey = child.key;
                    scanValue = sortValue;
                    if (entry === undefined) {
                        continue;
                    }
                    position = Object.freeze({index: position.index + 1, key: entry.key, finished: false});
                    cursorValue = sortValue;
                    entries.push(entry);
                }
                if (children.length < remaining) {
                    position = Object.freeze({...position, finished: true});
                    break;
                }
            }
            return entries;
        },
        reset
    };
}
