import {fail} from "../../../common/src/_packages";
import createCursorQuery from "./createCursorQuery";

export default function cursor(firebase, path, options = {}, tracking = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        fail("database/invalid-argument", "options must be an object.");
    }
    const {handle} = options;
    if (handle !== undefined && typeof handle !== "function") {
        fail("database/invalid-argument", "handle must be a function or undefined.");
    }
    let position = Object.freeze({index: -1, key: undefined, finished: false});
    let scanKey;
    let scanValue;
    let buffer = [];
    let offset = 0;
    let exhausted = false;

    const {
        initialQuery,
        continuationQuery,
        ascending,
        orderBy,
        byValue,
        startKey,
        endKey
    } = createCursorQuery(firebase, path, options);
    const byKey = orderBy === undefined && !byValue;

    const readPage = async (key, value, size) => {
        let query = key === undefined ? initialQuery : continuationQuery;
        if (key !== undefined) {
            if (ascending) {
                query = byKey ? query.startAfter(key) : query.startAfter(value, key);
            } else {
                query = byKey ? query.endBefore(key) : query.endBefore(value, key);
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
        scanKey = undefined;
        scanValue = undefined;
        buffer = [];
        offset = 0;
        exhausted = false;
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
            while (entries.length < n) {
                if (offset === buffer.length) {
                    if (exhausted) {
                        break;
                    }
                    const size = tracking.readSize?.() ?? n - entries.length;
                    buffer = await readPage(scanKey, scanValue, size);
                    offset = 0;
                    exhausted = buffer.length < size;
                    if (!buffer.length) {
                        break;
                    }
                }
                const child = buffer[offset];
                const sortValue = byKey ? child.key : byValue ? child.val() : child.child(orderBy).val();
                if ((startKey !== undefined && child.key < startKey) || (endKey !== undefined && child.key > endKey)
                    || tracking.accept?.(child.key) === false) {
                    scanKey = child.key;
                    scanValue = sortValue;
                    offset++;
                    continue;
                }
                const entry = await handleEntry(child);
                tracking.processed?.(child.key);
                scanKey = child.key;
                scanValue = sortValue;
                offset++;
                if (entry === undefined) {
                    continue;
                }
                position = Object.freeze({index: position.index + 1, key: entry.key, finished: false});
                entries.push(entry);
            }
            if (exhausted && offset === buffer.length) {
                position = Object.freeze({...position, finished: true});
                buffer = [];
                offset = 0;
            }
            return entries;
        },
        reset
    };
}
