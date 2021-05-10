import {fetchCallable} from "../../controllers/Firebase";
import {MutualMode} from "./MutualConstants";
import Pagination from "../../controllers/FirebasePagination";
import {firebaseMessaging as firebase} from "../../controllers/Firebase";

export const mutualRequestAccept = ({requestId}) => {
    return fetchCallable("mutualAction", {
        key: requestId,
        action: "accept",
    });
}

export const mutualRequestReject = ({requestId}) => {
    return fetchCallable("mutualAction", {
        key: requestId,
        action: "reject",
    });
}

export const mutualRequest = async ({currentUserData, mutualId, mutualType, mutualMode = MutualMode.SIMPLEX_QUIET, typeId, message}) => {
    let ref = firebase.database().ref();
    const uidId = `${currentUserData.id}_${mutualId}`;
    const idUid = `${mutualId}_${currentUserData.id}`;
    let request = {
        uid: currentUserData.id,
        id: mutualId,
        uid_id: uidId,
        id_uid: idUid,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        type: mutualType,
    };
    if (mutualMode === MutualMode.SIMPLEX_QUIET) {
        ref = ref.child("mutual").child(typeId);
    } else if (mutualMode === MutualMode.DUPLEX_APPROVE) {
        ref = ref.child("mutualrequests").child(typeId);
        request = {...request, typeId};
        if (message) request = {...request, message};
    }

    const existing = new Pagination({
        ref: "mutual/" + typeId,
        child: "uid_id",
        equals: uidId,
        size: 10,
    });
    if (existing.length > 0) {
        return null;
    } else {
        return ref.push(request)
            .then(ref => ({key: ref.key, value: {...request, timestamp: new Date().getTime()}}));
    }
}
