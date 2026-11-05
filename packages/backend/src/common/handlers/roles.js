import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class RoleListener extends BackendListener {
    constructor(backend) {
        super(["roles", "user_id"], backend);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Role]", `updated [${params.user_id}]`, {params, previous, value});

        if (value !== previous) {
            await createActivity(this.backend, {
                type: "user.role.change",
                details: {
                    previousRole: previous || null,
                    role: value || null,
                    uid: params.user_id || null,
                },
            });
        }
    }
}
