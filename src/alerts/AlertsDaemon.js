import React from "react";
import {useDispatch} from "react-redux";
import {matchPath, useHistory} from "react-router-dom";
import {alertsCounterReducer} from "./alertsCounterReducer";
import {useCurrentUserData} from "../controllers/UserData";
import {MenuBadge, useFirebase, usePages, useStore} from "../controllers/General";
import Pagination from "../controllers/FirebasePagination";
import notifySnackbar from "../controllers/notifySnackbar";

const AlertsDaemon = ({fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
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
            ref: firebase.database().ref("alerts").child(currentUserData.id),
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

        const daemonNew = firebase.database().ref("alerts").child(currentUserData.id).limitToLast(1);
        let lastKey = null;
        const alertsListener = (snapshot) => {
            if (!lastKey) {
                lastKey = snapshot.key;
                return;
            }
            if (lastKey && lastKey > snapshot.key) return;
            lastKey = snapshot.key;
            const match = matchPath(window.location.pathname, {
                exact: true,
                path: pages.alerts._route,
                strict: true
            });
            if (match) {
                return;
            }
            const alert = snapshot.val();
            fetchAlertContent({firebase, pages}, alert).then(({title, text}) => {
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
        daemonNew.on("child_added", alertsListener);
        return () => {
            daemonNew && daemonNew.off("child_added", alertsListener);
            dispatch({type: MenuBadge.RESET, page: pages.alerts});
        }
        // eslint-disable-next-line
    }, []);

    console.log("[AlertsDaemon] installed")
    return null;
}

export default AlertsDaemon;
