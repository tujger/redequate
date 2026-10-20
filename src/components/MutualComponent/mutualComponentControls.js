import {MutualMode} from "./MutualConstants";

export const mutualRequestAccept = ({backend, requestId, typeId}) => {
    return backend.request("mutualAction", {
        key: requestId,
        typeId,
        action: "accept",
    });
}

export const mutualRequestReject = ({backend, requestId, typeId}) => {
    return backend.request("mutualAction", {
        key: requestId,
        typeId,
        action: "reject",
    });
}

export const mutualRequest = async (
    {
        currentUserData,
        database,
        mutualId,
        mutualType,
        mutualMode = MutualMode.SIMPLEX_QUIET,
        typeId,
        message
    }) => {
    const uidId = `${currentUserData.id}_${mutualId}`;
    const idUid = `${mutualId}_${currentUserData.id}`;

    const existing = await database.cursor(["mutual", {typeId, _: true}], {
        equalTo: uidId,
        orderBy: ["uid_id"]
    }).then();

    if (existing.length > 0) {
        return null;
    }
    const path = [];
    let request = {
        uid: currentUserData.id,
        id: mutualId,
        uid_id: uidId,
        id_uid: idUid,
        timestamp: database.TIMESTAMP,
        type: mutualType,
    };
    if (mutualMode === MutualMode.SIMPLEX_QUIET) {
        path.push("mutual", {typeId, _: true});
    } else if (mutualMode === MutualMode.DUPLEX_APPROVE) {
        path.push("mutualrequests", {typeId, _: true});
        request = {...request, typeId};
        if (message) request = {...request, message};
    }

    return database.create(path).save(request)
        .then(key => ({key, value: {...request, timestamp: new Date().getTime()}}));
}
