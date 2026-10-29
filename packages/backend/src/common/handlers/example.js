import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";
import {createAlert} from "./alert";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["example", "example_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Example]", `created [${params.example_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Example]", `deleted [${params.exmaple_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Example]", `updated [${params.example_id}]`, {params, previous, value});
    }
}
