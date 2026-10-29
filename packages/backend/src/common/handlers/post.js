import BackendListener from "../BackendListener";

export default class PostListener extends BackendListener {
    constructor(backend) {
        super(["posts", "post_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Post]", `added ${params.post_id}`, {params, value});
        await this.backend.request("database.update", ["_counters", {id: "total"}, "posts"], this.backend.increment(1));
        if (value.uid) await this.backend.request("database.update", ["_counters", {id: value.uid}, "posts"], this.backend.increment(1));
    }

    async onUpdate({previous, value, params}) {
        console.debug("[Backend:Post]", `changed ${params.post_id}`, {previous, value});
    }

    async onDelete({value, params}) {
        console.debug("[Backend:Post]", `deleted ${params.post_id}`, {params, value});
        await this.backend.request("database.update", ["_counters", {id: "total"}, "posts"], this.backend.increment(-1));
        if (value.uid) await this.backend.request("database.update", ["_counters", {id: value.uid}, "posts"], this.backend.increment(-1));
    }
}
