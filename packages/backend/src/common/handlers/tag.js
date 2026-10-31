import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["tag", "tag_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Tag]", `created [${params.tag_id}]`, {params, value});
        await createActivity(this.backend, {
            type: "tag.create",
            details: {
                params, value,
            },
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Tag]", `deleted [${params.tag_id}]`, {params, value});

        const backend = this.backend;
        const cursor = await backend.request("database.cursor", ["_tag", {tag_id: params.tag_id}], {
            handle({key, value}) {
                backend.request("database.delete", ["posts", {post_id: key}]);
            }
        });
        cursor.next(1000000);

        await createActivity(this.backend, {
            type: "tag.delete",
            details: {
                params, value,
            },
        });
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Tag]", `updated [${params.tag_id}]`, {params, previous, value});
    }
}
