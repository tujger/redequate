import React from "react";
import {PostData} from "./PostData";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import {cacheDatas, useFirebase} from "../../controllers/General";
import {MutualError} from "../MutualComponent";
import {fetchCallable} from "../../controllers/Firebase";

export default (
    {
        allowedExtras,
        fetchItemId = item => item.key,
        currentUserData,
        onItemError,
        type,
        typeId,
    }) => async item => {

    currentUserData = currentUserData || useCurrentUserData();
    try {
        const postData = await cacheDatas.fetch(fetchItemId(item), id => {
            return PostData({type, allowedExtras}).fetch(id);
        });
        await postData.fetchCounters();
        await postData.fetchExtras(currentUserData.id);
        const userData = await cacheDatas.fetch(postData.uid, id => {
            return UserData().fetch(id, currentUserData.id ? [UserData.PUBLIC] : [UserData.NAME, UserData.IMAGE]);
        })
        postData._userData = userData;
        // console.log(postData)
        return postData;
    } catch (error) {
        console.error(item, type, error);
        let code = null;
        if (error && error.message && error.message.indexOf("Post not found") >= 0) code = MutualError.NOT_FOUND;
        if (onItemError) {
            return onItemError(error, {code, id: item.key, uid: currentUserData.id});
        } else {
            if (code === MutualError.NOT_FOUND) {
                fetchCallable("fixPost", currentUserData && currentUserData.id
                    ? {
                        code,
                        id: item.key,
                        uid: currentUserData.id
                    } : {
                        code,
                        id: item.key,
                    }
                )
                    .then(console.log)
                    .catch(console.error);

                fetchCallable("fixMutualStamp", {
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
