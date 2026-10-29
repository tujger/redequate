import BackendListener from "../BackendListener";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["tag", "tag_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Tag]", `created [${params.tag_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Tag]", `deleted [${params.tag_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Tag]", `updated [${params.tag_id}]`, {params, previous, value});
    }
}
