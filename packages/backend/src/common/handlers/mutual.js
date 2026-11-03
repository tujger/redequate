import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";

export default class MutualListener extends BackendListener {
    constructor(backend) {
        super(["mutual", "mutual_type", "mutual_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Mutual]", `created [${params.mutual_type}/${params.mutual_id}]`, {params, value});

        const {uid, id} = value;
        const {mutual_type: mutualType} = params;
        const mutualTypeS = `${mutualType}_s`;
        await updateCounter(this.backend, [{id}, "mutual", mutualTypeS], 1);
        await updateCounter(this.backend, [{id: uid}, "mutual", mutualType], 1);
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Mutual]", `deleted [${params.mutual_type}/${params.mutual_id}]`, {params, value});

        const {uid, id} = value;
        const {mutual_type: mutualType} = params;
        const mutualTypeS = `${mutualType}_s`;
        await updateCounter(this.backend, [{id}, "mutual", mutualTypeS], -1);
        await updateCounter(this.backend, [{id: uid}, "mutual", mutualType], -1);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Mutual]", `updated [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            previous,
            value
        });
    }
}
