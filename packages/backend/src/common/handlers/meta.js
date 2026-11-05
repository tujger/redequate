import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class MetaListener extends BackendListener {
    constructor(backend) {
        super(["meta", "setting"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Meta]", `created [${params.setting}]`, {params, value});

        if (params.setting === "maintenance") {
            await createActivity(this.backend, {
                type: "settings.maintenance",
                details: {
                    message: value.message ?? null,
                    state: "on",
                },
            });
        }
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Meta]", `deleted [${params.setting}]`, {params, value});

        if (params.setting === "maintenance") {
            await createActivity(this.backend, {
                type: "settings.maintenance",
                details: {
                    message: value.message ?? null,
                    state: "off",
                },
            });
        }
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Meta]", `updated [${params.setting}]`, {params, previous, value});

        const details = {};
        for (const x in previous) {
            if (previous[x] !== value[x]) {
                details[x] = [previous[x] || null, "=>", value[x] || null];
            }
        }
        for (const x in value) {
            if (previous[x] !== value[x]) {
                details[x] = [previous[x] || null, "=>", value[x] || null];
            }
        }
        await createActivity(this.backend, {
            type: "settings.update",
            details
        });
    }
}
