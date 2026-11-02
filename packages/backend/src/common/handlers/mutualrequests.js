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

        const {mutual_type: mutualType} = params;
        const {uid, id, message} = value;
        await updateCounter(this.backend, [{id}, "mutualrequests", {mutual_type: mutualType}], 1);
        await createAlert(this.backend, id, {
            uid,
            type: "request",
            id,
            author: id,
            message
        });
    }

    async onDelete({params, value}) {
        console.debug("[Backend:MutualRequest]", `deleted [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            value
        });
        const {mutual_type: mutualType} = params;
        const {id} = value;
        await updateCounter(this.backend, [{id}, "mutualrequests", {mutual_type: mutualType}], -1);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:MutualRequest]", `updated [${params.mutual_type}/${params.mutual_id}]`, {
            params,
            previous,
            value
        });

        const accepted = value.accepted;
        if (accepted) {
            const {mutual_type: mutualType} = params;
            const {uid, id, uid_id: uidId, id_uid: idUid, timestamp} = value;
            const direct = {
                id,
                uid,
                id_uid: idUid,
                uid_id: uidId,
                timestamp
            };
            const reverse = {
                id: uid,
                uid: id,
                id_uid: uidId,
                uid_id: idUid,
                timestamp
            }
            const cursor = await this.backend.request("database.cursor", ["mutual", {mutual_type: mutualType}, "mutual_id"], {
                equalTo: idUid,
                orderBy: ["uid_id"],
            });
            const foundRecords = await cursor.next(10);
            if (foundRecords.length === 0) {
                await this.backend.request("database.create", ["mutual", {mutual_type: mutualType}, "mutual_id"], reverse);
            }
            await this.backend.request("database.create", ["mutual", {mutual_type: mutualType}, "mutual_id"], direct);
            await this.backend.request("database.delete", ["mutualrequests", {mutual_type: mutualType}, {mutual_id: params.mutual_id}]);
        }
    }
}
