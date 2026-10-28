export default {
    path: ["posts", "post_id"],
    async onWrite({value, previous, params, backend}) {
        if (previous === null) {
            return onAdded({value, previous, params, backend});
        } else if (value === null) {
            return onDeleted({previous, params, backend});
        } else {
            return onChanged({value, previous, params, backend});
        }
    },
};

const onAdded = async ({params, value, backend}) => {
    console.debug("[Backend:Post]", `added ${params.post_id}`, {params, value, backend});
    await backend.request("database.update", ["_counters", {id: "total"}, "posts"], backend.increment(1));
    if (value.uid) await backend.request("database.update", ["_counters", {id: value.uid}, "posts"], backend.increment(1));

    //updateCounter(backend, [{id: previous.uid}, "posts"], 1)
}

const onChanged = async ({previous, value, params, backend}) => {
    console.debug("[Backend:Post]", `changed ${params.post_id}`, {previous, value, backend});
}

const onDeleted = async ({previous, params, backend}) => {
    console.debug("[Backend:Post]", `deleted ${params.post_id}`, {params, previous, backend});
    await backend.request("database.update", ["_counters", {id: "total"}, "posts"], backend.increment(-1));
    if (previous.uid) await backend.request("database.update", ["_counters", {id: previous.uid}, "posts"], backend.increment(-1));
}
