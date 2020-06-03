const Pagination = ({ref, child, value, pageSize = 10, order, start, update}) => {
    let baseRef = ref;
    let lastKey = null;
    let lastValue = null;

    const next = () => {
        let ref = baseRef;
        if(child) ref = ref.orderByChild(child);
        else if(value) ref = ref.orderByValue(value);
        else ref = ref.orderByKey();

        if (lastKey !== null) {
            // a previous page has been loaded so get the next one using the previous value/key
            // we have to start from the current cursor so add one to page size
            if(order === "asc") {
                if(child || value) {
                    ref = ref.startAt(lastValue, lastKey).limitToFirst(pageSize + 1);
                } else {
                    ref = ref.startAt(lastKey).limitToFirst(pageSize + 1);
                }
            } else {
                if(child || value) {
                    ref = ref.endAt(lastValue, lastKey).limitToLast(pageSize + 1);
                } else {
                    ref = ref.endAt(lastKey).limitToLast(pageSize + 1);
                }
            }
        } else {
            // this is the first page
            if(start) {
                if(order === "asc") {
                    ref = ref.startAt(start).endAt(start + "\uf8ff").limitToFirst(pageSize);
                } else {
                    ref = ref.startAt(start + "\uf8ff").endAt(start).limitToLast(pageSize);
                }
            } else {
                if(order === "asc") {
                    ref = ref.limitToFirst(pageSize);
                } else {
                    ref = ref.limitToLast(pageSize);
                }
            }
        }

        return ref.once("value").then(snap => {
            const keys = [];
            const data = []; // store data in array so it's ordered
            snap.forEach(ss => {
                data.push({...ss.val(), _key:ss.key});
                keys.push(ss.key);
                if(update) {
                    ss.ref.set(update(ss.key, ss.val()));
                }
            });

            if (lastKey !== null) {
                // skip the first value, which is actually the cursor
                if(order === "asc") {
                    keys.shift();
                    data.shift();
                } else {
                    keys.pop();
                    data.pop();
                }
            }

            // store the cursor
            if (data.length) {
                const last = order === "asc" ? data.length - 1 : 0;
                lastKey = keys[last];
                if(child) lastValue = data[last][child];
            }
            return data;
        });
    }
    return {
        next: next,
    }
}
export default Pagination;
