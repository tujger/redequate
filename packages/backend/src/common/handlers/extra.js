import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";
import {createAlert} from "./alert";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["extra", "extra_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Extra]", `created [${params.extra_id}]`, {params, value});

        if (!value) return;
        await updateCounter(this.backend, [{id: value.id}, value.type], 1);

        const author = await this.backend.request("database.read", ["posts", {post_id: value.id}, "uid"]);
        if (author === null || author === value.uid) return;
        await createAlert(this.backend, author, {
            uid: value.uid,
            id: value.id,
            type: value.type,
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Extra]", `deleted [${params.extra_id}]`, {params, value});
        if (!value) return;
        await updateCounter(this.backend, [{id: value.id}, value.type], -1);
    }
}
