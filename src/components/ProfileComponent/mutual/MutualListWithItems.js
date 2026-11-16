import React from "react";
import {useTranslation} from "react-i18next";
import {MutualList} from "../../MutualComponent";

export default (
    {
        header = undefined,
        unsubscribeLabel = undefined,
        userData,
        ...props
    }) => {
    const {t} = useTranslation();

    return <>
        {header}
        <MutualList
            mutualId={userData.id}
            unsubscribeLabel={unsubscribeLabel ? t(unsubscribeLabel) : undefined}
            {...props}
        />
    </>
}
