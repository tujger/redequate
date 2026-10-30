import BackendListener from "../BackendListener";
import {fetchExistingTags, filterTagTokens, parseTokens} from "./tag";
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
        if (!params.post_id) throw new Error("[Post] id is not defined");
        if (value.to) {
            await updateCounter(this.backend, [{id: value.uid}, "replies"], -1);
            if (value.root) await updateCounter(this.backend, [{id: value.root}, "replied"], -1);
            else console.warn("[Post] reply has no root, skipping root counter", value.to);
        } else {
            if (value.uid) await updateCounter(this.backend, [{id: value.uid}, "posts"], -1);
            await updateCounter(this.backend, [{id: "total"}, "posts"], -1);
        }
        const replies = await this.backend.request("database.read", ["posts"], {orderBy: "to", equalTo: params.post_id});
        for (const postId of Object.keys(replies || {})) {
            await this.backend.request("database.delete", ["posts", {post_id: postId}]);
        }
        await Promise.all((value.images || []).map(async url => {
            if (!url) return;
            try { await this.backend.storage.delete(url); }
            catch (error) { console.error(error); }
        }));

    }

    async onUpdate({previous, value, params}) {
        console.debug("[Backend:Post]", `updated [${params.post_id}]`, {params, previous, value});

        const previousImages = previous.images ?? [];
        const images = value.images ?? [];
        if ((previous.text ?? "") === (value.text ?? "") &&
            previousImages.length === images.length && previousImages.every((image, index) => image === images[index])) return;

        await parseTokens({backend:this.backend, text: value.text ?? ""})
            .then(filterTagTokens)
            .then(fetchExistingTags)
            .then(result => {
                console.log(">>>>>>>>>", result)
            })

    }
}
