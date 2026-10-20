import React from "react";
import {useTranslation} from "react-i18next";
import {DatabaseOrder} from "../../packages/database/src";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useDatabase} from "../controllers";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import AlertItem from "./AlertItem";

export default ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const {t} = useTranslation();

    const cursor = React.useMemo(() => database.cursor(["alerts", {user_id: currentUserData.id}], {
        order: DatabaseOrder.DESC,
    }), [database, currentUserData.id]);

    const itemTransform = data => ({data, fetchAlertContent});

    return <LazyListComponent
        cursor={cursor}
        ItemComponent={AlertItem}
        itemTransform={itemTransform}
        live
        noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
        placeholder={<AlertItem skeleton/>}
    />
}
