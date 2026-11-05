import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class UserListener extends BackendListener {
    constructor(backend) {
        super(["users_public", "user_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:User]", `created [${params.user_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:User]", `deleted [${params.user_id}]`, {params, value});

        await createActivity(this.backend, {
            type: "user.delete",
            details: {
                uid: params.user_id ?? null,
                public: value,
            },
        });
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:User]", `updated [${params.user_id}]`, {params, previous, value});

        // await createActivity(this.backend, {
        //     type: "user.role.change",
        //     details: {
        //         path: `${value.root ? value.root + "/" : ""}${value.to ? value.to + "/" : ""}${params.post_id}` || null,
        //         postId: params.post_id,
        //         uid: value.uid,
        //     },
        // });
    }
}
