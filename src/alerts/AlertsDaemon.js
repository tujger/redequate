import React from "react";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";
import {useDatabase} from "../../packages/database";
import Pagination from "../controllers/FirebasePagination";
import {MenuBadge, useFirebase, usePages, useStore} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserData} from "../controllers/UserData";
import {alertsCounterReducer} from "./alertsCounterReducer";

export default ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const database = useDatabase();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const store = useStore();

    React.useEffect(() => {
        let lastVisit = 0;
        if (store.getState() && store.getState().alertsVisit) {
            const value = store.getState().alertsVisit;
            lastVisit = value.timestamp;
        }
        const alertsPagination = new Pagination({
            ref: "alerts/" + currentUserData.id,
            child: "timestamp",
            start: lastVisit,
            size: 10000,
            timeout: 180000,
            update: () => {
            }
        });
        alertsPagination.next().then(() => {
            if (alertsPagination.countTotal) {
                dispatch({type: alertsCounterReducer.VALUE, value: alertsPagination.countTotal});
                dispatch({type: MenuBadge.INCREASE, page: pages.alerts});
            }
        }).catch(notifySnackbar);

        let lastKey = null;
        const listener = database.addEventListener(["alerts", currentUserData.id], {
            onChildAdd({key, value}) {
                if (!lastKey) {
                    lastKey = key;
                    return;
                }
                if (lastKey && lastKey > key) return;
                lastKey = key;
                const match = matchPath(window.location.pathname, {
                    exact: true,
                    path: pages.alerts._route,
                    strict: true
                });
                if (match) {
                    return;
                }
                fetchAlertContent({firebase, pages}, value).then(({title, text}) => {
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
        return () => {
            listener.remove();
            dispatch({type: MenuBadge.RESET, page: pages.alerts});
        }
        // eslint-disable-next-line
    }, []);

    console.log("[AlertsDaemon] installed")
    return null;
}
