import onCall from "../common/onCall";
import backend from "../backend";
import authorize from "../common/authorize";
import {database} from "../common/firebase";

export default onCall(async request => {
    await authorize(request, database, {adminOnly: true});

    const {uid, priority, ...data} = request.data;
    return backend.request("notification.send", {
        userId: uid,
        data,
        options: {priority},
    });
});
