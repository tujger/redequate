import React from "react";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";
import {useDatabase} from "../controllers";
import {MenuBadge, usePages, useStore} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import alertsCounterReducer from "./alertsCounterReducer";

export default ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const store = useStore();

    React.useEffect(() => {
        if (!currentUserData.id) return;
        let lastVisit = 0;
        if (store.getState() && store.getState().alertsVisit) {
            const value = store.getState().alertsVisit;
            lastVisit = value.timestamp;
        }
        const cursor = database.cursor(["alerts", {user_id: currentUserData.id}], {
            orderBy: ["timestamp"],
            start: lastVisit
        });
        cursor.next(10000).then(() => {
            if (cursor.count) {
                dispatch({type: alertsCounterReducer.VALUE, value: cursor.count});
                dispatch({type: MenuBadge.INCREASE, page: pages.alerts});
            }
        }).catch(notifySnackbar);

        const listener = database.addEventListener(["alerts", {user_id: currentUserData.id}], {
            onChildAdd({key, value}) {
                const match = matchPath(window.location.pathname, {
                    exact: true,
                    path: pages.alerts._route,
                    strict: true
                });
                if (match) {
                    return;
                }
                fetchAlertContent({database, pages}, value).then(({title, text}) => {
                    notifySnackbar({
                        id: pages.alerts.route,
                        onClick: () => history.push(pages.alerts.route),
                        title: <>
                            {title}: {text}
                        </>,
                    })
                }).catch(console.error);
                dispatch({type: MenuBadge.INCREASE, page: pages.alerts});
                dispatch({type: alertsCounterReducer.INCREASE});
            }
        })
        console.log("[AlertsDaemon] installed");
        return () => {
            listener.remove();
            dispatch({type: MenuBadge.RESET, page: pages.alerts});
        }
    }, [currentUserData.id]);

    return null;
}
