import update from "../../../../database/src/common/methods/update";
import {fail} from "../../../../common";
import BackendListener from "../BackendListener";

export default class ActivityListener extends BackendListener {
    constructor(backend) {
        super(["activity", "activity_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Activity]", `created [${params.activity_id}]`, {params, value});
        if (typeof value?.type !== "string" || !value.type.trim()) {
            fail("database/invalid-argument", "Activity type must be a non-empty string.");
        }
        return update(this.backend, ["_activity"], previous => {
            const records = {...previous};
            const key = Object.keys(records).find(key => records[key]?.type === value.type) ?? params.activity_id;
            return {...records, [key]: {
                activity_type_id: key, type: value.type, value: this.backend.TIMESTAMP,
            }};
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Activity]", `deleted [${params.activity_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Activity]", `updated [${params.activity_id}]`, {params, previous, value});
    }
}

export const createActivity = async (backend, {type = null, details = null} = {}) => {
    const uid = (await backend.getCurrentUser()) || 0;
    return backend.request("database.create",
        ["activity", "activity_id"],
        {
            uid,
            type,
            details,
            timestamp: backend.TIMESTAMP,
        },
    );
};
