import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";
import {createAlert} from "./alert";
import update from "../../../../database/src/common/methods/update";

export default class PostListener extends BackendListener {
    constructor(backend) {
        super(["posts", "post_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Post]", `created [${params.post_id}]`, {params, value});
        if (!value.to) {
            await updateCounter(this.backend, [{id: "total"}, "posts"], 1);
            if (value.uid) await updateCounter(this.backend, [{id: value.uid}, "posts"], 1);
            return;
        }

        const visited = new Set([params.post_id]);
        let toId = value.to, parent, root, rootKey;
        while (toId) {
            if (visited.has(toId)) throw new Error(`Cyclic post chain at ${toId}`);
            visited.add(toId);
            const ancestor = await this.backend.request("database.read", ["posts", {post_id: toId}]);
            if (!ancestor) throw new Error(`Not found post ${toId}`);
            parent ??= ancestor;
            root = ancestor;
            rootKey = toId;
            toId = ancestor.to;
        }

        const notified = new Set([value.uid]);
        const alert = {uid: value.uid, type: "replies", id: params.post_id, context: rootKey};
        await updateCounter(this.backend, [{id: value.uid}, "replies"], 1);
        if (!notified.has(parent.uid)) {
            await updateCounter(this.backend, [{id: parent.uid}, "replied"], 1);
            await createAlert(this.backend, parent.uid, alert);
            notified.add(parent.uid);
        }
        await update(this.backend, ["posts", {post_id: params.post_id}], {root: rootKey});
        await updateCounter(this.backend, [{id: rootKey}, "replied"], 1);
        if (!notified.has(root.uid)) await createAlert(this.backend, root.uid, alert);
    }

    async onDelete({value, params}) {
        console.debug("[Backend:Post]", `deleted [${params.post_id}]`, {params, value});
        await updateCounter(this.backend, [{id: "total"}, "posts"], -1);
        if (value.uid) await this.backend.request("database.update", ["_counters", {id: value.uid}, "posts"], this.backend.increment(-1));
    }

    async onUpdate({previous, value, params}) {
        console.debug("[Backend:Post]", `updated [${params.post_id}]`, {params, previous, value});
    }
}
