import {fail} from "../../../../common";
import update from "../../../../database/src/common/methods/update";
import resolvePath from "../../../../database/src/common/resolvePath";
import BackendListener from "../BackendListener";
import {updateCounter} from "./utils";

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

export const createMutualStamps = async (backend, {userId, mutualId}) => {
    return _updateMutualStamps(backend, {userId, mutualId}, userId);
}

export const deleteMutualStamps = async (backend, {userId, mutualId}) => {
    return _updateMutualStamps(backend, {userId, mutualId}, null);
}

const _updateMutualStamps = async (backend, {userId, mutualId}, payload) => {
    if (mutualId === null || mutualId === undefined) {
        fail("database/invalid-argument", "Stamp mutualId must not be null or undefined.");
    }

    const mutualTypes = await backend.request("database.read", ["mutual", "mutual_type"], {shallow: true})

    const updates = new Map();
    const object = {};
    const addUpdate = path => {
        const address = resolvePath(path);
        if (object[address]) return;
        updates.set(path, payload);
        object[address] = true;
    };
    addUpdate(["mutualstamps", {mutual_type: "_my"}, {user_id: userId}, {mutual_id: mutualId}]);
    for (const mutualType of mutualTypes) {
        const path = ["mutual", {mutual_type: mutualType}, "mutual_id"];
        const query = {orderBy: ["id"], equalTo: userId};
        const cursor = await backend.request("database.cursor", path, query);

        await cursor.next(10000).then(records => {
            records.forEach(({value}) => {
                if (value.uid === userId) return;
                addUpdate(["mutualstamps", {mutual_type: "_"}, {user_id: value.uid}, {mutual_id: mutualId}]);
                addUpdate(["mutualstamps", {mutual_type: mutualType}, {user_id: value.uid}, {mutual_id: mutualId}]);
            });
        });
    }
    await update(backend, updates);
}
