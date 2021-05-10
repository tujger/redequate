import {key} from "firebase-key"; // https://cartant.github.io/firebase-key/
import {firebaseMessaging as firebase} from "./Firebase";

function Pagination(
    {
        ref,
        child,
        value,
        size = 10,
        order = "asc",
        start,
        startDate,
        end,
        equals,
        endDate,
        update,
        timeout = 30000,
        transform,
        transformData
    }) {
    let baseRef = ref;
    const startKey = startDate !== undefined ? key(startDate || 0, "min") : undefined;
    const endKey = endDate !== undefined ? key(endDate, "min") : undefined;
    let cursorKey = order === "asc" ? startKey : endKey;
    let cursorValue;
    let countTotal = 0;
    let count = 0;
    let finished = false;
    let started = false;
    let timeoutTask;

    if (baseRef.constructor.name === "String") {
        baseRef = firebase.database().ref(baseRef);
    } else if (baseRef instanceof Array) {
        baseRef = firebase.database().ref(baseRef.join("/"));
    }

    const next = () => new Promise((resolve, reject) => {
        let timedout = false;
        const checkIfFinished = async () => {
            if (finished) throw [];
        }
        const importArguments = async props => {
            return {
                ...props,
                baseRef,
                child,
                end,
                endDate,
                equals,
                order,
                size,
                start,
                startDate,
                term: {child, value, equals, start, ref: baseRef.key, size},
                timeout,
                transform,
                transformData,
                update,
                value,
            };
        }
        const validateArguments = async props => {
            const {child, endDate, equals, start, startDate, value} = props;
            if (start && equals) throw Error(`[FP] Ambiguous terms: start=${start}, equals=${equals}`);
            if (child && value) throw Error(`[FP] Ambiguous terms: child=${child}, value=${value}`);
            if (startDate && endDate && startDate > endDate) throw Error(`[FP] Incorrect terms: startDate=${startDate} > endDate=${endDate}`);
            return props;
        }
        const importGlobalFlags = async props => {
            return {...props, cursorKey, cursorValue, startKey, endKey};
        }
        const buildRef = async props => {
            const {baseRef, child, value} = props;
            let ref = baseRef;
            if (child) ref = ref.orderByChild(child);
            else if (value) ref = ref.orderByValue();
            else ref = ref.orderByKey();
            return {...props, ref};
        }
        const updateSize = async props => {
            const {cursorKey, size} = props;
            const size_ = cursorKey === undefined ? size : size + 1;
            return {...props, size: size_};
        }
        const detectTypeOfValue = async props => {
            const {end, equals, start} = props;
            const isString = value => {
                return value !== undefined && value !== null && value.constructor.name === "String";
            }
            const isNumber = value => {
                return value !== undefined && value !== null && value.constructor.name === "Number";
            }
            const value = start !== undefined ? start : end !== undefined ? end : equals;
            return {...props, isString: isString(value), isNumber: isNumber(value)};
        }
        const buildMinMax = async props => {
            const {end, endKey, equals, start, startKey, isNumber, isString} = props;

            const minKey = startKey !== undefined ? startKey : "\u0020";
            const maxKey = endKey !== undefined ? endKey : "\uf8ff";

            let minValue, maxValue;
            if (isString) {
                minValue = (start || equals || "") + "\u0020";
                maxValue = (end || start || equals || "") + "\uf8ff";
            } else if (isNumber) {
                minValue = start !== undefined ? start : equals !== undefined ? equals : Number.MIN_SAFE_INTEGER;
                maxValue = end !== undefined ? end : equals !== undefined ? equals : Number.MAX_SAFE_INTEGER;
            } else {
                minValue = "\u0020";
                maxValue = "\uf8ff"
            }
            return {...props, minKey, minValue, maxKey, maxValue};
        }
        const buildCursorIfEquals = async props => {
            const {cursorKey, cursorValue, equals, maxKey, minKey, order} = props;
            if (equals !== undefined) {
                const cursorKey_ = cursorKey || (order === "asc" ? minKey : maxKey);
                const cursorValue_ = cursorValue !== undefined ? cursorValue : equals;
                return {
                    ...props,
                    cursorKey: cursorKey_,
                    cursorValue: cursorValue_,
                    minValue: cursorValue_,
                    maxValue: cursorValue_
                };
            }
            return props;
        }
        const buildCursorIfStart = async props => {
            const {cursorValue, maxValue, minValue, start} = props;
            if (start !== undefined) {
                const cursorValue_ = cursorValue || (order === "asc" ? minValue : maxValue);
                return {...props, cursorValue: cursorValue_};
            }
            return props;
        }
        const buildCursorIfByKey = async props => {
            const {child, cursorKey, cursorValue, equals, start, value} = props;
            if (child === undefined && value === undefined) {
                if (start !== undefined) {
                    const cursorKey_ = cursorKey || start;
                    return {...props, cursorKey: cursorKey_};
                } else if (equals !== undefined) {
                    const cursorKey_ = cursorValue || equals;
                    return {...props, cursorKey: cursorKey_, minKey: cursorKey_, maxKey: cursorKey_};
                }
            }
            return props;
        }
        const buildFirst = async props => {
            const {cursorKey, cursorValue, minKey, minValue, order} = props;
            let firstKey, firstValue;
            if (order === "asc") {
                firstKey = cursorKey || minKey;
                firstValue = cursorValue !== undefined ? cursorValue : minValue;
            } else {
                firstKey = minKey;
                firstValue = minValue;
            }
            return {...props, firstKey, firstValue};
        }
        const buildLast = async props => {
            const {cursorValue, cursorKey, maxKey, maxValue, order} = props;
            let lastKey, lastValue;
            if (order === "asc") {
                lastKey = maxKey;
                lastValue = maxValue;
            } else {
                lastKey = cursorKey || maxKey;
                lastValue = cursorValue !== undefined ? cursorValue : maxValue;
            }
            return {...props, lastKey, lastValue};
        }
        const applyTermsIfKey = async props => {
            const {child, firstKey, lastKey, ref, value} = props;
            if (child || value) return props;
            const ref_ = ref.startAt(firstKey).endAt(lastKey);
            return {...props, ref: ref_};
        }
        const applyTermsIfChild = async props => {
            const {child, firstKey, firstValue, lastKey, lastValue, ref} = props;
            if (!child) return props;
            const ref_ = ref.startAt(firstValue, firstKey).endAt(lastValue, lastKey);
            return {...props, ref: ref_};
        }
        const applyTermsIfValue = async props => {
            const {firstKey, firstValue, lastKey, lastValue, ref, value} = props;
            if (!value) return props;
            const ref_ = ref.startAt(firstValue, firstKey).endAt(lastValue, lastKey);
            return {...props, ref: ref_};
        }
        const applyLimits = async props => {
            const {order, ref, size} = props;
            let ref_;
            if (order === "asc") {
                ref_ = ref.limitToFirst(size);
            } else {
                ref_ = ref.limitToLast(size);
            }
            return {...props, ref: ref_};
        }
        const installTimeout = async props => {
            const {timeout} = props;
            const timeoutTask = setTimeout(() => {
                console.error(`[FP] time out on ${toString()}`);
                reject(new Error("Time out on data request."));
                timedout = true;
            }, timeout);
            return {...props, timeoutTask};
        }
        const fetchData = async props => {
            const {ref} = props;
            const snapshot = await ref.once("value");
            return {...props, snapshot}
        }
        const removeTimeoutOrThrow = async props => {
            const {timeoutTask} = props;
            clearTimeout(timeoutTask);
            if (timedout) throw "time-out";
            return props;
        }
        const extractChildren = async props => {
            const {snapshot, minKey, maxKey, order} = props;
            const children = [];
            snapshot.forEach(child => {
                if (order === "asc" && child.key > maxKey) return;
                if (order === "desc" && child.key < minKey) return;
                children.push(child)
            });
            return {...props, children};
        }
        const processChildren = async props => {
            const {child, children, update} = props;
            const keys = [];
            const data = [];
            for (const ss of children) {
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
            const {child, data, keys, order, value} = props;
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
        const transformItems = async props => {
            const {data, transform} = props;
            if (transform) {
                const data_ = Promise.all(data.map(async item => transform(item)));
                return {...props, data: data_};
            }
            return props;
        }
        const transformDataset = async props => {
            const {data, transformData} = props;
            if (transformData) {
                const data_ = await transformData(data);
                return {...props, data: data_};
            }
            return props;
        }
        const exportGlobalFlags = async props => {
            const {data, size, cursorKey: cursorKey_, cursorValue: cursorValue_} = props;
            if (data.length < size) finished = true;
            countTotal += data.length;
            count = data.length;
            cursorKey = cursorKey_;
            cursorValue = cursorValue_;
            return props;
        }
        const returnData = async props => {
            const {data} = props;
            resolve(data);
        }
        const print = order => async props => {
            console.log(order, props);
            return props;
        }
        const catchEvent = async event => {
            if (timedout) {
                console.warn(event);
                return;
            }
            if (event instanceof Error) {
                reject(event);
            } else {
                console.warn("[FP] catch event", event);
                resolve(event);
            }
        }

        return checkIfFinished()
            .then(importArguments)
            .then(validateArguments)
            .then(importGlobalFlags)
            .then(buildRef)
            .then(updateSize)
            .then(detectTypeOfValue)
            .then(buildMinMax)
            .then(buildCursorIfEquals)
            .then(buildCursorIfStart)
            .then(buildCursorIfByKey)
            .then(buildFirst)
            .then(buildLast)
            .then(applyTermsIfKey)
            .then(applyTermsIfChild)
            .then(applyTermsIfValue)
            .then(applyLimits)
            .then(installTimeout)
            .then(fetchData)
            .then(removeTimeoutOrThrow)
            .then(extractChildren)
            .then(processChildren)
            .then(extractCursor)
            .then(transformItems)
            .then(transformDataset)
            .then(exportGlobalFlags)
            .then(returnData)
            .catch(catchEvent);
    });

    const reset = () => {
        clearTimeout(timeoutTask);
        cursorKey = order === "asc" ? startKey : endKey;
        cursorValue = undefined;
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
            return `${baseRef.path}|${child || ""}|${start || ""}|${end || ""}|${equals || ""}|${value || ""}|${order || ""}|${startDate || ""}|${endDate || ""}`;
        },
        next: next,
        reset: reset,
        toString: toString,
    }
}

export default Pagination;
