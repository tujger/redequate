import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["extra", "extra_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Extra]", `created [${params.extra_id}]`, {value});

        if (!value) return;
        await updateCounter(this.backend, [{id: value.id}, value.type], 1);

        const author = await this.backend.request("database.read", ["posts", {post_id: value.id}, "uid"]);
        if (author === null || author === value.uid) return;
        await this.backend.request("database.create", ["alerts", {user_id: author}, "alert_id"], {
            uid: value.uid || null,
            context: null,
            id: value.id,
            message: null,
            new: true,
            path: null,
            timestamp: this.backend.TIMESTAMP,
            type: value.type,
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Extra]", `deleted [${params.extra_id}]`, {value});
        if (!value) return;
        await updateCounter(this.backend, [{id: value.id}, value.type], -1);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Extra]", `updated [${params.extra_id}]`, {previous, value});
    }
}
