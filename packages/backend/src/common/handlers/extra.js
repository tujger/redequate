export default {
    path: ["extra", "extra_id"],
    async onWrite({value, previous, params, backend}) {
        if(previous === null) {
            console.log("[Backend:Extra]", `added ${params.extra_id}`, {previous, value, backend});
            await backend.request("database.update", ["_counters", {id: value.id}, value.type], backend.increment(1));
        } else if(value === null) {
            console.log("[Backend:Extra]", `deleted ${params.extra_id}`, {previous, value, backend});
            await backend.request("database.update", ["_counters", {id: previous.id}, previous.type], backend.increment(-1));
        } else {
            console.log("[Backend:Extra]", `changed ${params.extra_id}`, {previous, value, backend});
        }
    },
};
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
