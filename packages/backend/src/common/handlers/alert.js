import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";

export default class AlertListener extends BackendListener {
    constructor(backend) {
        super(["alerts", "user_id", "alert_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Alert]", `created [${params.user_id}/${params.alert_id}]`, {value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Alert]", `deleted [${params.user_id}/${params.alert_id}]`, {value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Alert]", `updated [${params.user_id}/${params.alert_id}]`, {previous, value});
    }
}
