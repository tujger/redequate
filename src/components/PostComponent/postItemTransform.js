import {cacheDatas} from "../../controllers/General";
import {UserData} from "../../controllers/UserData";
import {getCurrentUserData} from "../../controllers/useCurrentUserData";
import {MutualError} from "../MutualComponent";
import {PostData} from "./PostData";

export default (
    {
        allowedExtras,
        backend,
        currentUserData,
        database,
        fetchItemId = item => item.key,
        onItemError,
        type,
        typeId,
    }) => async item => {

    const user = currentUserData || getCurrentUserData();
    try {
        const postData = await cacheDatas.fetch(fetchItemId(item), id => {
            return PostData({allowedExtras, database, type}).fetch(id);
        });
        await postData.fetchCounters();
        await postData.fetchExtras(user?.id);
        const userData = await cacheDatas.fetch(postData.uid, id => {
            return new UserData(database).fetch(id, user?.id ? [UserData.PUBLIC] : [UserData.NAME, UserData.IMAGE]);
        })
        postData._userData = userData;
        // console.log(postData)
        return postData;
    } catch (error) {
        console.error(item, type, error);
        let code = null;
        if (error && error.message && error.message.indexOf("Post not found") >= 0) code = MutualError.NOT_FOUND;
        if (onItemError) {
            return onItemError(error, {code, id: item.key, uid: user?.id});
        } else {
            if (code === MutualError.NOT_FOUND) {
                backend.request("fixPost", user && user?.id
                    ? {
                        code,
                        id: item.key,
                        uid: user?.id
                    } : {
                        code,
                        id: item.key,
                    }
                )
                    .then(console.log)
                    .catch(console.error);

                backend.request("fixMutualStamp", {
                    code,
                    id: item.key,
                    uid: item.value,
                    typeId
                })
                    .then(console.log)
                    .catch(console.error);
            } else {
                throw error;
            }
        }
    }
}
