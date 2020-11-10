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
        firebase,
        onItemError = error => {
        },
        type
    }) => async item => {

    currentUserData = currentUserData || useCurrentUserData();
    firebase = firebase || useFirebase();
    try {
        const postData = await cacheDatas.fetch(fetchItemId(item), id => {
            return PostData({firebase, type, allowedExtras}).fetch(id);
        });
        await postData.fetchCounters();
        await postData.fetchExtras(currentUserData.id);
        const userData = await cacheDatas.fetch(postData.uid, id => {
            return UserData(firebase).fetch(id, [UserData.NAME, UserData.IMAGE]);
        })
        postData._userData = userData;
        // console.log(postData)
        return postData;
    } catch (error) {
        console.error(error);
        if (error && error.message && error.message.indexOf("Post not found") >= 0) {
            onItemError(error, {code: MutualError.NOT_FOUND, id: item.key, uid: currentUserData.id})
            fetchCallable(firebase)("fixPost", currentUserData && currentUserData.id
                ? {
                    id: item.key,
                    uid: currentUserData.id
                } : {
                    id: item.key,
                }
            ).then(console.log)
                .catch(console.error);
        } else {
            throw error;
        }
    }
}
