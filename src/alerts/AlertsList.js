import React from "react";
import AlertItem from "./AlertItem";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserData} from "../controllers/UserData";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useTranslation} from "react-i18next";

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
