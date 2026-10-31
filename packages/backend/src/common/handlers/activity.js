import update from "../../../../database/src/common/methods/update";
import validatePath from "../../../../database/src/common/validatePath";
import BackendListener from "../BackendListener";

export default class ActivityListener extends BackendListener {
    constructor(backend) {
        super(["activity", "activity_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Activity]", `created [${params.activity_id}]`, {params, value});
        validatePath(["_activity", "activity_type_id"]);

        const records = await this.backend.request("database.read", ["_activity", "activity_type_id"], {
            equalTo: value.type,
            orderBy: ["type"]
        });
        const data = {type: value.type, value: this.backend.TIMESTAMP};
        const key = Object.keys(records ?? {})[0];
        if (key) {
            return update(this.backend, ["_activity", {activity_type_id: key}], data);
        } else {
            return this.backend.request("database.create", ["_activity", "activity_type_id"], data);
        }
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Activity]", `deleted [${params.activity_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Activity]", `updated [${params.activity_id}]`, {params, previous, value});
    }
}

export const createActivity = (backend, {uid = 0, type = null, details = null} = {}) => {
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
