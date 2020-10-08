import React from "react";
import AlertItem from "./AlertItem";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase} from "../controllers/General";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";

const AlertsList = ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();

    return <LazyListComponent
        cache={"alerts"}
        itemComponent={(item, index) => <AlertItem key={item.key} data={item} fetchAlertContent={fetchAlertContent}/>}
        live
        noItemsComponent={<AlertItem label={"No alerts"}/>}
        pagination={() => new Pagination({
            ref: firebase.database().ref("alerts").child(currentUserData.id),
            order: "desc",
        })}
        placeholder={<AlertItem skeleton/>}
        placeholders={1}
    />
}

export default AlertsList;
