import BackendListener from "../BackendListener";
import {createAlert} from "./alerts";
import {updateCounter} from "./utils";

export default class MutualRequestListener extends BackendListener {
    constructor(backend) {
        super(["mutualrequests", "mutual_type", "mutual_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:MutualRequest]", `created [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            value
        });

        const {mutual_type} = params;
        const {uid, id, message} = value;
        await updateCounter(this.backend, [{id}, mutual_type], 1);
        await createAlert(this.backend, uid, {
            uid: id,
            type: "request",
            id: uid,
            author: uid,
            message
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:MutualRequest]", `deleted [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            value
        });
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:MutualRequest]", `updated [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            previous,
            value
        });
    }
}
