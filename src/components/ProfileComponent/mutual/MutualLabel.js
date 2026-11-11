import React from "react";
import {useTranslation} from "react-i18next";
import CounterComponent from "../../CounterComponent";

export default ({label, path}) => {
    const {t} = useTranslation();
    return <React.Fragment>
        {t(label)}
        <CounterComponent
            // onChange={handleRefresh(typeId, MutualListMode.SUBSCRIBES)}
            live
            path={path}
            prefix={" ("} suffix={")"}/>
    </React.Fragment>
}
