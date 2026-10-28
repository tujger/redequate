export default {
    path: ["posts", "post_id"],
    async onWrite({value, previous, params, backend}) {
        if(previous === null) {
            console.log("[Backend:Post]", `added ${params.post_id}`, {previous, value, backend});
            await backend.request("database.update", ["_counters", {id: "total"}, "posts"], backend.increment(1));
            if (value.uid) await backend.request("database.update", ["_counters", {id: value.uid}, "posts"], backend.increment(1));
            //updateCounter(backend, [{id: previous.uid}, "posts"], 1)
        } else if(value === null) {
            console.log("[Backend:Post]", `deleted ${params.post_id}`, {previous, value, backend});
            await backend.request("database.update", ["_counters", {id: "total"}, "posts"], backend.increment(-1));
            if (previous.uid) await backend.request("database.update", ["_counters", {id: previous.uid}, "posts"], backend.increment(-1));
        } else {
            console.log("[Backend:Post]", `changed ${params.post_id}`, {previous, value, backend});
        }
    },
};
