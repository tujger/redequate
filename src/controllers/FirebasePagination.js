const Pagination = ({ref, child, value, size = 10, order = "asc", start, equals, update}) => {
    let baseRef = ref;
    let lastKey = null;
    let lastValue = null;
    let countTotal = 0;
    let count = 0;
    let finished = false;
    let started = false;

    const next = () => {
        if (finished) return new Promise((resolve, reject) => {
            resolve([]);
        });

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
                if (equals) {
                    ref = ref.startAt(lastValue, lastKey).endAt(equals + "\uf8ff").limitToFirst(size + 1);
                    // ref = ref.equalTo(equals, lastKey).limitToFirst(size + 1);
                } else if (child || value) {
                    ref = ref.startAt(lastValue, lastKey).limitToFirst(size + 1);
                } else {
                    ref = ref.startAt(lastKey).limitToFirst(size + 1);
                }
            } else {
                if (equals) {
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
            if (equals) {
                if (order === "asc") {
                    ref = ref.equalTo(equals).limitToFirst(size);
                } else {
                    // ref = ref.startAt(start).endAt(start + "\uf8ff").limitToLast(size);
                    ref = ref.equalTo(equals).limitToLast(size);
                }
            } else if (start) {
                if (order === "asc") {
                    ref = ref.startAt(start).endAt(start + "\uf8ff").limitToFirst(size);
                } else {
                    ref = ref.startAt(start).endAt(start + "\uf8ff").limitToLast(size);
                }
            } else {
                if (order === "asc") {
                    ref = ref.limitToFirst(size);
                } else {
                    ref = ref.limitToLast(size);
                }
            }
        }

        return ref.once("value").then(async snap => {
            const keys = [];
            const data = []; // store data in array so it's ordered
            const children = [];
            snap.forEach(child => {
                children.push(child)
            });
            for (let ss of children) {
                if(lastKey && ss.key === lastKey) continue;
                if (update) {
                    const value = ss.val();
                    const newValue = await update(ss.key, value);
                    if(newValue !== value) {
                        ss.ref.set(newValue);
                    }
                    if (keys.length > 1) keys.pop();
                    if (data.length > 1) data.pop();
                }
                if(value) {
                    data.push({_key: ss.key, value: ss.val()});
                } else {
                    data.push({...ss.val(), _key: ss.key});
                }
                keys.push(ss.key);
                count++;
                countTotal++;
            }
            // if (lastKey !== null) {
            //     // skip the first value, which is actually the cursor
            //     if (order === "asc") {
            //         keys.shift();
            //         data.shift();
            //     } else {
            //         keys.pop();
            //         data.pop();
            //     }
            //     count--;
            //     countTotal--;
            // }

            // store the cursor
            if (keys.length) {
                const last = order === "asc" ? keys.length - 1 : 0;
                lastKey = keys[last];
                if (child && data[last]) lastValue = data[last][child];
                else if(value && data[last]) lastValue = data[last].value;
            }
            if (count < size) finished = true;
            return data;
        });
    }
    const reset = () => {
        baseRef.database.goOnline();
        lastKey = null;
        lastValue = null;
        countTotal = 0;
        count = 0;
        finished = false;
        started = false;
    }
    return {
        next: next,
        reset: reset,
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
        get started() {
            return started
        },
    }
}
export default Pagination;
