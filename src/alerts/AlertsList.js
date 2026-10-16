import React from "react";
import {useTranslation} from "react-i18next";
import {DatabaseOrder} from "../../packages/database/src";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import LazyListComponent2 from "../components/LazyListComponent/LazyListComponentOld";
import {useDatabase} from "../controllers";
import Pagination from "../controllers/FirebasePagination";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import AlertItem from "./AlertItem";
import AlertItem2 from "./AlertItem2";

export default ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const {t} = useTranslation();

    const cursor = React.useMemo(() => database.cursor(["alerts", currentUserData.id], {
        order: DatabaseOrder.DESC,
    }), [database, currentUserData.id]);

    const itemTransform = data => ({data, fetchAlertContent});

    return <div style={{display: "flex", flexWrap: "nowrap", gap: "1rem"}}>
        <div>
            <LazyListComponent2
                cache={"alerts"}
                itemComponent={(item, index) => <AlertItem key={item.key} data={item}
                                                            fetchAlertContent={fetchAlertContent}/>}
                live
                noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
                pagination={() => new Pagination({
                    ref: "alerts/" + currentUserData.id,
                    order: "desc",
                })}
                placeholder={<AlertItem skeleton/>}
                placeholders={1}
            />
        </div>
        <div>
            <LazyListComponent
                cursor={cursor}
                ItemComponent={AlertItem}
                itemTransform={itemTransform}
                live
                noItemsComponent={<AlertItem label={t("Alerts.No alerts")}/>}
                placeholder={<AlertItem skeleton/>}
            />
        </div>
    </div>
}
