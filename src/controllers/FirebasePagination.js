import {key} from "firebase-key";

function Pagination({ref, child, value, size = 10, order = "asc", start, startDate = null, end, equals, endDate = null, update, timeout = 30000, transform}) {
    const baseRef = ref;
    const _startKey = startDate ? key(startDate, "min") : undefined;
    const _endKey = endDate ? key(endDate, "min") : undefined;
    let startKey = order === "asc" ? _startKey : _endKey;
    let endKey = order === "asc" ? _endKey : _startKey;
    let lastValue = undefined;
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

        // console.log(child, equals, start, startKey, endKey, lastValue)
        if (startKey !== undefined) {
            // a previous page has been loaded so get the next one using the previous value/key
            // we have to start from the current cursor so add one to page size
            if (order === "asc") {
                if (equals !== undefined) {
                    ref = ref.startAt(lastValue, startKey).endAt(equals + "\uf8ff").limitToFirst(size + 1);
                    // ref = ref.equalTo(lastValue, startKey).limitToFirst(size + 1);
                } else if (child || value) {
                    ref = ref.startAt(lastValue, startKey).limitToFirst(size + 1);
                } else {
                    ref = ref.startAt(startKey).limitToFirst(size + 1);
                }
            } else {
                if (equals !== undefined) {
                    // console.log(equals, startKey, endKey, lastValue)
                    // ref = ref.startAt(equals + "\uf8ff").endAt(lastValue, startKey).limitToLast(size + 1);
                    ref = ref.startAt(equals).endAt(lastValue, startKey).limitToLast(size + 1);
                } else if (child || value) {
                    ref = ref.endAt(lastValue, startKey).limitToLast(size + 1);
                } else {
                    ref = ref.endAt(startKey).limitToLast(size + 1);
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
            } else if (start !== undefined) {
                if (order === "asc") {
                    const endAt = start !== null && start.constructor.name === "String" ? ((end || start) + "\uf8ff") : (end || Number.MAX_SAFE_INTEGER);
                    ref = ref.startAt(start).endAt(endAt).limitToFirst(size);
                } else {
                    const endAt = start !== null && start.constructor.name === "String" ? (start + "\uf8ff") : Number.MAX_SAFE_INTEGER;
                    ref = ref.startAt(start).endAt(endAt).limitToLast(size);
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
            let data = []; // store data in array so it's ordered
            const children = [];

            snap.forEach(child => {
                children.push(child)
            });
            for (const ss of children) {
                // console.log(ss.key, startKey, endKey)
                if (startKey) {
                    if (order === "asc" && ss.key <= startKey) continue;
                    else if (order === "desc" && ss.key >= startKey) continue;
                }
                if (endKey) {
                    if (order === "asc" && ss.key > endKey) break;
                    else if (order === "desc" && ss.key < endKey) break;
                }
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
                startKey = keys[last];
                // console.log(child, startKey, data[last])
                if (child && data[last]) lastValue = data[last].value[child];
                else if (value && data[last]) lastValue = data[last].value;
            }
            if (count < size) finished = true;
            if (transform) {
                data = Promise.all(data.map(async item => transform(item)));
            }
            // console.log(startDate, _startKey, _endKey, startKey, data)
            // console.log(data);
            resolve(data);
        }, error => {
            reject(error);
        });
    })

    const next1 = async () => {
        const checkIfFinished = async () => {
            if (finished) throw [];
        }
        const checkTerms = async props => {
            if (start && equals) throw Error(`[FP] Ambiguous terms: start=${start}, equals=${equals}`);
            if (child && value) throw Error(`[FP] Ambiguous terms: child=${child}, value=${value}`);
            return {
                ...props,
                child,
                cursorKey: startKey,
                cursorValue: lastValue,
                end,
                equals,
                order,
                size,
                start,
                term: {child, value, equals, start, ref: baseRef.key, size},
                value,
            };
        }
        const buildRef = async props => {
            const {child, value} = props;
            let ref = baseRef;
            if (child) ref = ref.orderByChild(child);
            else if (value) ref = ref.orderByValue();
            else ref = ref.orderByKey();
            return {...props, ref};
        }
        const updateSize = async props => {
            const {size, cursorKey} = props;
            const size_ = cursorKey === undefined ? size : size + 1;
            return {...props, size: size_};
        }
        const termsForEquals = async props => {
            const {equals, cursorValue} = props;
            if (equals !== undefined) {
                const cursorValue_ = cursorValue || equals;
                const limitValue = (equals && equals.constructor.name === "String") ? equals + "\uf8ff" : cursorValue_;
                return {...props, limitValue, cursorValue: cursorValue_};
            }
            return props;
        }
        const termsForStarts = async props => {
            const {start, cursorValue} = props;
            if (start !== undefined) {
                const cursorValue_ = cursorValue || start;
                const limitValue = (start !== null && start.constructor.name === "String") ? (start + "\uf8ff") : Number.MAX_SAFE_INTEGER;
                return {...props, limitValue, cursorValue: cursorValue_};
            }
            return props;
        }
        const termsForEmpty = async props => {
            const {start, equals, cursorKey, limitKey} = props;
            if (start === undefined && equals === undefined) {
                const cursorKey_ = cursorKey || "\u0000";
                const limitKey_ = limitKey || "\uf8ff";
                // const ref_ = ref.startAt("\u0000").endAt("\uf8ff");
                return {...props, limitKey: limitKey_, cursorKey: cursorKey_};
            }
            return props;
        }
        const applyTerms = async props => {
            const {size, ref, order, cursorValue, cursorKey, limitValue, limitKey} = props;
            let ref_;
            if (order === "asc") {
                if (child || value) {
                    ref_ = ref.startAt(cursorValue, cursorKey).endAt(limitValue, limitKey);
                } else {
                    ref_ = ref.startAt(cursorKey).endAt(limitKey);
                }
                ref_ = ref_.limitToFirst(size);
            } else {
                if (child || value) {
                    ref_ = ref.startAt(cursorValue, cursorKey).endAt(limitValue, limitKey);
                    // ref_ = ref.startAt(limitValue, limitKey).endAt(cursorValue, cursorKey).limitToLast(size);
                } else {
                    ref_ = ref;
                    ref_ = ref.startAt(cursorKey).endAt(limitKey);
                }
                ref_ = ref_.limitToLast(size);
            }
            return {...props, ref: ref_};
        }
        const fetchData = async props => {
            const {ref} = props;
            const snapshot = await ref.once("value");
            return {...props, snapshot}
        }
        const extractChildren = async props => {
            const {snapshot, ...rest} = props;
            const children = [];
            snapshot.forEach(child => {
                children.push(child)
            });
            return {...rest, children};
        }
        const processChildren = async props => {
            const {children, startKey, endKey} = props;
            const keys = [];
            const data = [];
            for (const ss of children) {
                // console.log(ss.key, startKey, endKey)
                // if (startKey) {
                //     if (order === "asc" && ss.key <= startKey) continue;
                //     else if (order === "desc" && ss.key >= startKey) continue;
                // }
                // if (endKey) {
                //     if (order === "asc" && ss.key > endKey) break;
                //     else if (order === "desc" && ss.key < endKey) break;
                // }
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
            }
            return {...props, data, keys};
        }
        const extractCursor = async props => {
            const {keys, order, child, value, data} = props;
            if (keys.length) {
                const last = order === "asc" ? keys.length - 1 : 0;
                const cursorKey = keys[last];
                let cursorValue;
                if (child && data[last]) cursorValue = data[last].value[child];
                else if (value && data[last]) cursorValue = data[last].value;

                return {...props, cursorKey, cursorValue}
            }
            return props;
        }
        const transformData = async props => {
            const {data} = props;
            if (transform) {
                const data_ = Promise.all(data.map(async item => transform(item)));
                return {...props, data: data_};
            }
            return props;
        }
        const updateGlobalFlags = async props => {
            const {data, size, cursorKey, cursorValue} = props;
            if (data.length < size) finished = true;
            countTotal += data.length;
            count = data.length;
            startKey = cursorKey;
            lastValue = cursorValue;
            return data;
        }
        const print = async props => {
            console.log(props);
            return props;
        }
        const catchEvent = async event => {
            console.log("ERR", event)
            if (event instanceof Error) throw event;
            return event;
        }

        return checkIfFinished()
            .then(checkTerms)
            .then(buildRef)
            .then(updateSize)
            .then(termsForEquals)
            .then(termsForStarts)
            .then(termsForEmpty)
            .then(print)
            .then(applyTerms)
            .then(fetchData)
            .then(extractChildren)
            .then(processChildren)
            .then(extractCursor)
            .then(transformData)
            .then(print)
            .then(updateGlobalFlags)
            .then(print)
            .catch(catchEvent)
        ;
    }

    const reset = () => {
        // baseRef.database.goOnline();
        clearTimeout(timeoutTask);
        startKey = order === "asc" ? _startKey : _endKey;
        endKey = order === "asc" ? _endKey : _startKey;
        lastValue = undefined;
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
