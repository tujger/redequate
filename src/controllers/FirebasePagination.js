function Pagination({ref, child, value, size = 10, order = "asc", start, end, equals, update, timeout = 30000}) {
    let baseRef = ref;
    let lastKey = null;
    let lastValue = null;
    let countTotal = 0;
    let count = 0;
    let finished = false;
    let started = false;
    let timeoutTask;

    const next = () => new Promise((resolve, reject) => {
        if (finished) {
            resolve([]);
            return;
        }

        let ref = baseRef;
        if (child) ref = ref.orderByChild(child);
        else if (value) ref = ref.orderByValue();
        else ref = ref.orderByKey();
        count = 0;
        started = true;

        if (lastKey !== null) {
            // a previous page has been loaded so get the next one using the previous value/key
            // we have to start from the current cursor so add one to page size
            if (order === "asc") {
                if (equals !== undefined) {
                    ref = ref.startAt(lastValue, lastKey).endAt(equals + "\uf8ff").limitToFirst(size + 1);
                    // ref = ref.equalTo(lastValue, lastKey).limitToFirst(size + 1);
                } else if (child || value) {
                    ref = ref.startAt(lastValue, lastKey).limitToFirst(size + 1);
                } else {
                    ref = ref.startAt(lastKey).limitToFirst(size + 1);
                }
            } else {
                if (equals !== undefined) {
                    ref = ref.startAt(equals).endAt(lastValue, lastKey).limitToLast(size + 1);
                    // ref = ref.equalTo(lastValue, lastKey).limitToLast(size + 1);
                } else if (child || value) {
                    ref = ref.endAt(lastValue, lastKey).limitToLast(size + 1);
                } else {
                    ref = ref.endAt(lastKey).limitToLast(size + 1);
                }
            }
        } else {
            // this is the first page
            if (equals !== undefined) {
                if (order === "asc") {
                    ref = ref.equalTo(equals).limitToFirst(size);
                } else {
                    // ref = ref.startAt(start).endAt(start + "\uf8ff").limitToLast(size);
                    ref = ref.equalTo(equals).limitToLast(size);
                }
            } else if (start) {
                if (order === "asc") {
                    ref = ref.startAt(start).endAt((end || start) + "\uf8ff").limitToFirst(size);
                } else {
                    ref = ref.startAt(start).endAt(start + "\uf8ff").limitToLast(size);
                }
            } else {
                if (order === "asc") {
                    ref = ref.startAt("\u0000").limitToFirst(size);
                } else {
                    ref = ref.endAt("\uf8ff").limitToLast(size);
                }
            }
        }
        // baseRef.database.goOnline();

        let timeoutFired = false;
        clearTimeout(timeoutTask);
        timeoutTask = setTimeout(() => {
            timeoutFired = true;
            console.error(`[FP] timed out for ${toString()}`);
            reject(new Error("Timed out on data request."));
        }, timeout);

        return ref.once("value").then(async snap => {
            clearTimeout(timeoutTask);
            if (timeoutFired) return;
            const keys = [];
            const data = []; // store data in array so it's ordered
            const children = [];

            snap.forEach(child => {
                children.push(child)
            });
            for (let ss of children) {
                if (lastKey && ss.key === lastKey) continue;
                const value = ss.val();
                if (child && value[child] === undefined) continue;
                if (update) {
                    const newValue = await update(ss.key, value);
                    if (newValue !== undefined && newValue !== value) {
                        ss.ref.set(newValue);
                    }
                    if (keys.length > 1) keys.pop();
                    if (data.length > 1) data.pop();
                }
                if (value) {
                    data.push({value: ss.val(), key: ss.key});
                } else if (child) {
                    data.push({value: ss.val(), key: ss.key});
                } else {
                    data.push({value: ss.val(), key: ss.key});
                }
                keys.push(ss.key);
                count++;
                countTotal++;
            }
            // store the cursor
            if (keys.length) {
                const last = order === "asc" ? keys.length - 1 : 0;
                lastKey = keys[last];
                // console.log(child, lastKey, data[last])
                if (child && data[last]) lastValue = data[last].value[child];
                else if (value && data[last]) lastValue = data[last].value;
            }
            if (count < size) finished = true;
            resolve(data);
        }, error => {
            reject(error);
        });
    })
    const reset = () => {
        // baseRef.database.goOnline();
        clearTimeout(timeoutTask);
        lastKey = null;
        lastValue = null;
        countTotal = 0;
        count = 0;
        finished = false;
        started = false;
    }
    const toString = () => {
        return `[P] by ${
            child ? "child: " + child : value ? "value: " + value : "key"
        }, ${
            start ? "start: " + start + ", " : ""
        }${
            end ? "end: " + end + ", " : ""
        }${
            equals !== undefined ? "equals: " + equals + ", " : ""
        }order: ${order}, count: ${count}, countTotal: ${countTotal}, ${
            started ? "started" : "not started"
        }, ${
            finished ? "finished" : "not finished"
        }`;
    }
    return {
        get count() {
            return count
        },
        get countTotal() {
            return countTotal
        },
        get finished() {
            return finished
        },
        get order() {
            return order;
        },
        get ref() {
            return baseRef;
        },
        get size() {
            return size;
        },
        get started() {
            return started
        },
        get asString() {
            return toString();
        },
        get term() {
            return `${ref.path}|${child || ""}|${start || ""}|${end || ""}|${equals || ""}|${value || ""}`;
        },
        next: next,
        reset: reset,
        toString: toString,
    }
}

export default Pagination;
