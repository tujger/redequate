import React from "react";
import {useTranslation} from "react-i18next";
import {MutualList} from "../../MutualComponent";
import {useBackend} from "../../../controllers";
import useDatabase from "../../../controllers/AppContext/useDatabase";
import {mentionTags, mentionUsers} from "../../../controllers/mentionTypes";
import PostComponent from "../../PostComponent/PostComponent";
import postItemTransform from "../../PostComponent/postItemTransform";

export default (
    {
        header = undefined,
        unsubscribeLabel = undefined,
        userData,
        ...props
    }) => {
    const backend = useBackend();
    const database = useDatabase();
    const {t} = useTranslation();

    const onItemError = (error, options) => {
        console.error(error)
    }

    return <>
        {header}
        <MutualList
            itemComponent={item => <PostComponent
                key={item.id}
                mentions={[mentionUsers, mentionTags]}
                postData={item}
                userData={item._userData}
            />}
            itemTransform={postItemTransform({backend, database, onItemError})}
            mutualId={userData.id}
            unsubscribeLabel={unsubscribeLabel ? t(unsubscribeLabel) : undefined}
            {...props}
        />
    </>
}
