import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";

export default class MutualListener extends BackendListener {
    constructor(backend) {
        super(["mutual", "mutual_type", "mutual_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Mutual]", `created [${params.mutual_type}/${params.mutual_id}]`, {params, value});

        const {uid, id} = value;
        const {mutual_type} = params;
        await updateCounter(this.backend, [{id: id}, "mutual", mutual_type], 1);

        const mutual_type_s = `${mutual_type}_s`;
        await updateCounter(this.backend, [{id: uid}, "mutual", mutual_type_s], 1);

    }

    async onDelete({params, value}) {
        console.debug("[Backend:Mutual]", `deleted [${params.mutual_type}/${params.mutual_id}]`, {params, value});

        const {uid, id} = value;
        const {mutual_type} = params;
        await updateCounter(this.backend, [{id: id}, "mutual", mutual_type], -1);

        const mutual_type_s = `${mutual_type}_s`;
        await updateCounter(this.backend, [{id: uid}, "mutual", mutual_type_s], -1);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Mutual]", `updated [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            previous,
            value
        });
    }
}
