import BackendListener from "../BackendListener";

export default class ExtraListener extends BackendListener {
    constructor(backend) {
        super(["extra", "extra_id"], backend);
    }

    async onCreate({value, params}) {
        console.debug("[Backend:Extra]", `added ${params.extra_id}`, {value});
        await this.backend.request("database.update", ["_counters", {id: value.id}, value.type], this.backend.increment(1));
    }

    async onDelete({value, params}) {
        console.debug("[Backend:Extra]", `deleted ${params.extra_id}`, {value});
        await this.backend.request("database.update", ["_counters", {id: value.id}, value.type], this.backend.increment(-1));
    }

    async onUpdate({value, previous, params}) {
        console.debug("[Backend:Extra]", `changed ${params.extra_id}`, {previous, value});
    }
}

//         await updateCounter(database, extra.id, extra.type, 1);


// const updateExtraAlert = (extraId, extra) => {
//     return dataRef("posts").child(extra.id).child("uid").once("value")
//         .then(snapshot => {
//             if(!snapshot.exists()) return;
//             const uid = snapshot.val();
//             if(extra.uid === uid) return;
//
//             return createAlert({
//                 author: extra.uid,
//                 id: extra.id,
//                 type: extra.type,
//                 uid: uid,
//             });
//         })
// }
//
// export const extraCreated = onValueCreated({ref: "/extra/{extraId}", instance: databaseInstance}, async ({data, params}) => {
//
//     const extra = data.val();
//     const extraId = params.extraId;
//     console.log("[Extra]", extraId, "added", JSON.stringify(extra));
//     if(extra) {
//         await updateCounter(database, extra.id, extra.type, 1);
//         await updateExtraAlert(extraId, extra);
//     }
//     return null;
// });
