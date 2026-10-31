import update from "../../../../database/src/common/methods/update";
import BackendListener from "../BackendListener";
import resolveTags from "../helpers/resolveTags";
import {createActivity} from "./activity";
import {createAlert} from "./alert";
import {updateCounter} from "./utils";

export default class PostListener extends BackendListener {
    constructor(backend) {
        super(["posts", "post_id"], backend);
    }

    async onCreate({params, value}) {
        console.log("[Backend:Post]", `created [${params.post_id}]`, {params, value});

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

        if (value.to) {
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
        } else {
            await updateCounter(this.backend, [{id: "total"}, "posts"], 1);
            if (value.uid) await updateCounter(this.backend, [{id: value.uid}, "posts"], 1);
        }

        const addTags = await resolveTags({backend: this.backend, text: value.text ?? "", createIfAbsent: true});
        const promises = addTags.map(tag => linkPostToTag({
            backend: this.backend,
            postId: params.post_id,
            tag,
            post: value
        }));

        await Promise.all(promises);
    }

    async onDelete({value, params}) {
        console.log("[Backend:Post]", `deleted [${params.post_id}]`, {params, value});
        if (!params.post_id) throw new Error("[Post] id is not defined");
        if (value.to) {
            await updateCounter(this.backend, [{id: value.uid}, "replies"], -1);
            if (value.root) await updateCounter(this.backend, [{id: value.root}, "replied"], -1);
            else console.warn("[Post] reply has no root, skipping root counter", value.to);
        } else {
            if (value.uid) await updateCounter(this.backend, [{id: value.uid}, "posts"], -1);
            await updateCounter(this.backend, [{id: "total"}, "posts"], -1);
        }
        const replies = await this.backend.request("database.read", ["posts"], {
            orderBy: "to",
            equalTo: params.post_id
        });
        for (const postId of Object.keys(replies || {})) {
            await this.backend.request("database.delete", ["posts", {post_id: postId}]);
        }
        await Promise.all((value.images || []).map(async url => {
            if (!url) return;
            try {
                await this.backend.storage.delete(url);
            } catch (error) {
                console.error(error);
            }
        }));

        const deleteTags = await resolveTags({backend: this.backend, text: value.text ?? ""});
        const promises = deleteTags.map(tag => unlinkPostFromTag({backend: this.backend, postId: params.post_id, tag}));

        await Promise.all(promises);
    }

    async onUpdate({previous, value, params}) {
        console.log("[Backend:Post]", `updated [${params.post_id}]`, {params, previous, value});

        const previousImages = previous.images ?? [];
        const images = value.images ?? [];
        if ((previous.text ?? "") === (value.text ?? "") &&
            previousImages.length === images.length && previousImages.every((image, index) => image === images[index])) return;

        const previousTags = await resolveTags({backend: this.backend, text: previous.text ?? ""});
        const valueTags = await resolveTags({backend: this.backend, text: value.text ?? "", createIfAbsent: true});

        const deleteTags = previousTags.filter(tag => !valueTags.find(t => t.key === tag.key));
        const addTags = valueTags.filter(tag => !previousTags.find(t => t.key === tag.key));

        const promises = [
            ...addTags.map(tag => linkPostToTag({backend: this.backend, postId: params.post_id, tag, post: value})),
            ...deleteTags.map(tag => unlinkPostFromTag({backend: this.backend, postId: params.post_id, tag}))
        ];

        await Promise.all(promises);

        await createActivity(this.backend, {
            type: "post.update",
            details: {
                path: `${value.root ? value.root + "/" : ""}${value.to ? value.to + "/" : ""}${params.post_id}` || null,
                postId: params.post_id,
                uid: value.uid,
            },
        });
    }
}


const linkPostToTag = ({backend, postId, post, tag}) => {
    if (post.to) return;
    return update(backend, ["_tag", {tag_id: tag.key}, {post_id: postId}], () => post.uid);
}

const unlinkPostFromTag = ({backend, postId, tag}) => {
    return backend.request("database.delete", ["_tag", {tag_id: tag.key}, {post_id: postId}]);
}
