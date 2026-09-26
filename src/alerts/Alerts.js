import React from "react";
import {useDispatch} from "react-redux";
import AllReadIcon from "@material-ui/icons/ClearAll";
import AlertsList from "./AlertsList";
import Clear from "@material-ui/icons/Clear";
import {alertsCounterReducer} from "./alertsCounterReducer";
import {alertsVisitReducer} from "./alertsVisitReducer";
import AlertsDaemon from "./AlertsDaemon";
import {useCurrentUserData} from "../controllers/UserData";
import {MenuBadge, useFirebase, usePages} from "../controllers/General";
import ProgressView from "../components/ProgressView";
import Pagination from "../controllers/FirebasePagination";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import notifySnackbar from "../controllers/notifySnackbar";
import ConfirmComponent from "../components/ConfirmComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import {useTranslation} from "react-i18next";
import baseStyles from "../themes/Base.module.css";
import alertStyles from "./styles/Alerts.module.css";

const Alerts = ({daemon, fetchAlertContent, classes: givenClasses}) => {
    const classes = givenClasses || {};
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {allRead, allClear} = state;
    const {t} = useTranslation();

    const handleAllRead = () => {
        setState({...state, allRead: true});
    }

    const handleAllReadConfirm = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, allRead: false});
        new Pagination({
            ref: "alerts/" + currentUserData.id,
            order: "desc",
            size: 10000,
            timeout: 180000,
            update: (key, data) => {
                const newdata = JSON.parse(JSON.stringify(data));
                if (newdata) {
                    delete newdata.new;
                }
                return newdata;
            }
        }).next()
            .then(() => dispatch({type: lazyListComponentReducer.RESET, cache: "alerts"}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    const handleClear = () => {
        setState({...state, allClear: true});
    }

    const handleClearConfirm = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, allClear: false});
        firebase.database().ref("alerts").child(currentUserData.id).set(null)
            .then(() => dispatch({type: lazyListComponentReducer.RESET, cache: "alerts"}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    React.useEffect(() => {
        if (daemon) return;
        dispatch({type: alertsCounterReducer.RESET});
        dispatch({type: alertsVisitReducer.UPDATE});
        dispatch({type: lazyListComponentReducer.RESET, cache: "alerts"});
        dispatch({type: MenuBadge.RESET, page: pages.alerts});

        return () => {
            dispatch({type: alertsVisitReducer.UPDATE});
        }
        // eslint-disable-next-line
    }, [])

    if (!fetchAlertContent) {
        notifySnackbar(new Error("'fetchAlertContent' must be defined for Alerts"));
        return null;
    }
    if (daemon) return <AlertsDaemon fetchAlertContent={fetchAlertContent}/>;

    return <>
        <NavigationToolbar
            className={[classes.topSticky, alertStyles.toolbar].filter(Boolean).join(" ")}
            backButton={null}
            mediumButton={<button
                aria-label={t("Common.Clear")}
                className={[alertStyles.iconButton, baseStyles.ripple].join(" ")}
                onClick={handleClear}
                title={t("Common.Clear")}
                type='button'
            >
                <Clear/>
            </button>}
            rightButton={<button
                aria-label={t("Alerts.All read")}
                className={[alertStyles.iconButton, baseStyles.ripple].join(" ")}
                onClick={handleAllRead}
                title={t("Alerts.All read")}
                type='button'
            >
                <AllReadIcon/>
            </button>}
        />
        <div className={[classes.center, alertStyles.list].filter(Boolean).join(" ")}>
            <AlertsList fetchAlertContent={fetchAlertContent}/>
        </div>
        {allRead && <ConfirmComponent
            children={t("Alerts.All alerts will be marked as read.")}
            onCancel={() => setState({...state, allRead: false})}
            onConfirm={handleAllReadConfirm}
            title={t("Alerts.All read?")}
        />}
        {allClear && <ConfirmComponent
            children={t("Alerts.All alerts will be removed.")}
            confirmLabel={t("Common.Clear")}
            critical
            onCancel={() => setState({...state, allClear: false})}
            onConfirm={handleClearConfirm}
            title={t("Alerts.Clear all?")}
        />}
    </>
};

export default Alerts;
