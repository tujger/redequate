import {fail} from "../../../../common";
import update from "../../../../database/src/common/methods/update";
import {updateCounter} from "./utils";
import BackendListener from "../BackendListener";

export default class MutualStampListener extends BackendListener {
    constructor(backend) {
        super(["mutualstamps", "mutual_type", "user_id", "mutual_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:MutualStamp]", `created [${params.mutual_type}/${params.user_id}/${params.mutual_id}]`, {
            params,
            value
        });

        await updateCounter(this.backend, [{id: params.user_id}, "mutualstamps", {mutual_type: params.mutual_type}], 1);
    }

    async onDelete({params, value}) {
        console.debug("[Backend:MutualStamp]", `deleted [${params.mutual_type}/${params.user_id}/${params.mutual_id}]`, {
            params,
            value
        });

        await updateCounter(this.backend, [{id: params.user_id}, "mutualstamps", {mutual_type: params.mutual_type}], -1);
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:MutualStamp]", `updated [${params.mutual_type}/${params.user_id}/${params.mutual_id}]`, {
            params,
            previous,
            value
        });
    }
}

export async function createMutualStamps(backend, {userId, mutualId, value}) {
    if (mutualId === null || mutualId === undefined) {
        fail("database/invalid-argument", "Stamp mutualId must not be null or undefined.");
    }

    const mutualTypes = await backend.request("database.read", ["mutual", "mutual_type"], {shallow: true})

    const updates = new Map();
    for (const mutualType of mutualTypes) {
        updates.set(["mutualstamps", "_my", {user_id: userId}, {mutual_id: mutualId}], userId);

        const path = ["mutual", {mutual_type: mutualType}, "mutual_id"];
        const query = {orderBy: ["uid"], equalTo: userId};
        const cursor = await backend.request("database.cursor", path, query);

        await cursor.next(10000).then(records => {
            records.forEach(({key, value}) => {
                console.log("STAMPS", {path, query, mutualType, userId, mutualId, value});
                if (value.uid !== userId) return;

                updates.set(["mutualstamps", "_", {user_id: value.id}, {mutual_id: mutualId}], userId);
                updates.set(["mutualstamps", {mutual_type: mutualType}, {user_id: value.id}, {mutual_id: mutualId}], userId)
            });
        });
    }
    await update(backend, updates);
}
