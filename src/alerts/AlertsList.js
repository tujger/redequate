import React from "react";
import {useTranslation} from "react-i18next";
import {DatabaseOrder} from "../../packages/database/src";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useDatabase} from "../controllers";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import AlertItem from "./AlertItem";

const AlertsList = ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const {t} = useTranslation();

    const itemTransform = data => {
        console.log(data)
        return data;
    }

    return <LazyListComponent
        cursor={database.cursor(["alerts", currentUserData.id], {
            live: true,
            order: DatabaseOrder.DESC,
        })}
        ItemComponent={(item, index) => <AlertItem key={item.key} data={item} fetchAlertContent={fetchAlertContent}/>}
        itemTransform={itemTransform}
        noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
        placeholder={<AlertItem skeleton/>}
    />
}

export default AlertsList;
