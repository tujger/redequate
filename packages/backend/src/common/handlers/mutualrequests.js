import BackendListener from "../BackendListener";

export default class MutualRequestListener extends BackendListener {
    constructor(backend) {
        super(["mutualrequests", "mutual_type", "mutual_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:MutualRequest]", `created [${params.mutual_type}/${params.mutual_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:MutualRequest]", `deleted [${params.mutual_type}/${params.mutual_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:MutualRequest]", `updated [${params.mutual_type}/${params.mutual_id}]`, {params, previous, value});
    }
}
