import {fail} from "../../../common/src/_packages";
import {resolvePath} from "./common";

export default function cursor(firebase, path, options = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
        fail("database/invalid-argument", "options must be an object.");
    }
    const {handle} = options;
    if (handle !== undefined && typeof handle !== "function") {
        fail("database/invalid-argument", "handle must be a function or undefined.");
    }
    let position = Object.freeze({index: -1, key: undefined, finished: false});

    const effectivePath = resolvePath(path);

    const reset = () => {
        position = Object.freeze({index: -1, key: undefined, finished: false});
    };

    return {
        get position() {
            return position;
        },
        async next(n = 1) {
            if (!Number.isSafeInteger(n) || n <= 0) {
                fail("database/invalid-argument", "n must be a positive safe integer.");
            }
            if (position.finished) return [];

            const entries = [];
            let scanKey = position.key;
            while (entries.length < n) {
                const remaining = n - entries.length;
                let query = firebase.database().ref(effectivePath).orderByKey();
                if (scanKey !== undefined) query = query.startAfter(scanKey);
                const snapshot = await query.limitToFirst(remaining).once("value");
                const children = [];
                snapshot.forEach(child => {
                    children.push(child);
                });
                for (const child of children) {
                    let entry = {key: child.key, value: child.val()};
                    if (handle) {
                        // A handler may mutate its input without requesting a write.
                        const replacement = await handle(JSON.parse(JSON.stringify(entry)));
                        if (replacement !== undefined) {
                            await child.ref.set(replacement);
                            if (replacement === null) {
                                scanKey = child.key;
                                continue;
                            }
                            const saved = await child.ref.once("value");
                            if (!saved.exists()) {
                                scanKey = child.key;
                                continue;
                            }
                            entry = {key: child.key, value: saved.val()};
                        }
                    }
                    position = Object.freeze({index: position.index + 1, key: entry.key, finished: false});
                    scanKey = child.key;
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
