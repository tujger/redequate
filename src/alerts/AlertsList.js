import React from "react";
import {useTranslation} from "react-i18next";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserData} from "../controllers/UserData";
import AlertItem from "./AlertItem";

const AlertsList = ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const {t} = useTranslation();

    return <LazyListComponent
        cache={"alerts"}
        itemComponent={(item, index) => <AlertItem key={item.key} data={item} fetchAlertContent={fetchAlertContent}/>}
        live
        noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
        pagination={() => new Pagination({
            ref: "alerts/" + currentUserData.id,
            order: "desc",
        })}
        placeholder={<AlertItem skeleton/>}
        placeholders={1}
    />
}

export default AlertsList;
