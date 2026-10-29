import BackendListener from "../BackendListener";
import validatePath from "../../../../database/src/common/validatePath";

export default class ActivityListener extends BackendListener {
    constructor(backend) {
        super(["activity", "activity_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Activity]", `created [${params.activity_id}]`, {params, value});
        validatePath(["_activity", "types", {type: value.type}]);
        return this.backend.request("database.update", ["_activity", "types", value.type], this.backend.TIMESTAMP);
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
