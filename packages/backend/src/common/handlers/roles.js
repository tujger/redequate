import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class RoleListener extends BackendListener {
    constructor(backend) {
        super(["roles", "user_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Role]", `created [${params.user_id}]`, {params, value});

        await this.backend.changeRole(params.user_id, value);
        await createActivity(this.backend, {
            type: "user.role.create",
            details: {
                role: value ?? null,
                uid: params.user_id ?? null,
            },
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Role]", `deleted [${params.user_id}]`, {params, value});

        await this.backend.changeRole(params.user_id, null);
        await createActivity(this.backend, {
            type: "user.role.delete",
            details: {
                role: value ?? null,
                uid: params.user_id ?? null,
            },
        });
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Role]", `updated [${params.user_id}]`, {params, previous, value});

        if (value !== previous) {
            await this.backend.changeRole(params.user_id, value);
            await createActivity(this.backend, {
                type: "user.role.change",
                details: {
                    previousRole: previous ?? null,
                    role: value ?? null,
                    uid: params.user_id ?? null,
                },
            });
        }
    }
}
