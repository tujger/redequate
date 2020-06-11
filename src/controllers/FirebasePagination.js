const Pagination = ({ref, child, value, pageSize = 10, order = "asc", start, equals, update}) => {
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
                    ref = ref.equalTo(equals, lastKey).limitToFirst(pageSize + 1);
                } else if (child || value) {
                    ref = ref.startAt(lastValue, lastKey).limitToFirst(pageSize + 1);
                } else {
                    ref = ref.startAt(lastKey).limitToFirst(pageSize + 1);
                }
            } else {
                if (equals) {
                    ref = ref.equalTo(equals, lastKey).limitToLast(pageSize + 1);
                } else if (child || value) {
                    ref = ref.endAt(lastValue, lastKey).limitToLast(pageSize + 1);
                } else {
                    ref = ref.endAt(lastKey).limitToLast(pageSize + 1);
                }
            }
        } else {
            // this is the first page
            if (equals) {
                if (order === "asc") {
                    ref = ref.equalTo(equals).limitToFirst(pageSize);
                } else {
                    ref = ref.equalTo(equals).limitToLast(pageSize);
                }
            } else if (start) {
                if (order === "asc") {
                    ref = ref.startAt(start).endAt(start + "\uf8ff").limitToFirst(pageSize);
                } else {
                    ref = ref.startAt(start + "\uf8ff").endAt(start).limitToLast(pageSize);
                }
            } else {
                if (order === "asc") {
                    ref = ref.limitToFirst(pageSize);
                } else {
                    ref = ref.limitToLast(pageSize);
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
            if (lastKey !== null) {
                // skip the first value, which is actually the cursor
                if (order === "asc") {
                    keys.shift();
                    data.shift();
                } else {
                    keys.pop();
                    data.pop();
                }
                count--;
                countTotal--;
            }

            // store the cursor
            if (keys.length) {
                const last = order === "asc" ? keys.length - 1 : 0;
                lastKey = keys[last];
                if (child && data[last]) lastValue = data[last][child];
                else if(value && data[last]) lastValue = data[last].value;
            }
            if (count < pageSize) finished = true;
            return data;
        });
    }
    const reset = () => {
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
        get started() {
            return started
        },
        get finished() {
            return finished
        },
    }
}
export default Pagination;
