import React from "react";
import AlertItem from "./AlertItem";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase} from "../controllers/General";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {useTranslation} from "react-i18next";

const AlertsList = ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const {t} = useTranslation();

    return <LazyListComponent
        cache={"alerts"}
        itemComponent={(item, index) => <AlertItem key={item.key} data={item} fetchAlertContent={fetchAlertContent}/>}
        live
        noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
        pagination={() => new Pagination({
            ref: firebase.database().ref("alerts").child(currentUserData.id),
            order: "desc",
        })}
        placeholder={<AlertItem skeleton/>}
        placeholders={1}
    />
}

export default AlertsList;
