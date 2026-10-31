import BackendListener from "../BackendListener";

export default class UserListener extends BackendListener {
    constructor(backend) {
        super(["users_public", "user_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:User]", `created [${params.user_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:User]", `deleted [${params.user_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:User]", `updated [${params.user_id}]`, {params, previous, value});
    }
}
