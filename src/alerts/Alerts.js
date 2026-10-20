import Clear from "@mui/icons-material/Clear";
import AllReadIcon from "@mui/icons-material/ClearAll";
import React from "react";
import {useTranslation} from "react-i18next";
import {useDispatch} from "react-redux";
import {DatabaseOrder} from "../../packages/database/src";
import ConfirmComponent from "../components/ConfirmComponent";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import NavigationToolbar from "../components/NavigationToolbar";
import ProgressView from "../components/ProgressView";
import {useDatabase} from "../controllers";
import {MenuBadge, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserDataValue} from "../controllers/useCurrentUserData";
import Button from "../controls/Button/Button";
import baseStyles from "../themes/Base.module.css";
import {alertsCounterReducer} from "./alertsCounterReducer";
import AlertsDaemon from "./AlertsDaemon";
import AlertsList from "./AlertsList";
import {alertsVisitReducer} from "./alertsVisitReducer";

export default ({daemon, fetchAlertContent}) => {
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
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
        database.cursor(["alerts", {user_id: currentUserData.id}], {
            handle({value}) {
                return {...value, new: null};
            },
            order: DatabaseOrder.DESC
        })
            .next(10000)
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
        database.write(["alerts", {user_id: currentUserData.id}], null)
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
            backButton={null}
            mediumButton={<Button
                aria-label={"Clear"}
                color={"secondary"}
                icon={<Clear/>}
                onClick={handleClear}
                title={t("Common.Clear")}
                variant={"text"}
            />}
            rightButton={<Button
                color={"secondary"}
                icon={<AllReadIcon/>}
                onClick={handleAllRead}
                title={t("Alerts.All read")}
                variant={"text"}
            />}
        />
        <div className={baseStyles.content}>
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
