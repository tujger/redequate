import {fetchCallable} from "../../controllers/Firebase";

export const mutualRequestAccept = ({requestId, firebase}) => {
    return fetchCallable(firebase)("mutualAction", {
        key: requestId,
        action: "accept",
    });
}

export const mutualRequestReject = ({requestId, firebase}) => {
    return fetchCallable(firebase)("mutualAction", {
        key: requestId,
        action: "reject",
    });
}
