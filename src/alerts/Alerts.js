import React from "react";
import {useDispatch} from "react-redux";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
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
import {styles} from "../controllers/Theme";
import withStyles from "@material-ui/styles/withStyles";
import NavigationToolbar from "../components/NavigationToolbar";
import {useTranslation} from "react-i18next";

const Alerts = ({daemon, fetchAlertContent, classes}) => {
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
            ref: firebase.database().ref("alerts").child(currentUserData.id),
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
            className={classes.topSticky}
            backButton={null}
            mediumButton={<IconButton
                aria-label={t("Common.Clear")}
                children={<Clear/>}
                onClick={handleClear}
                title={t("Common.Clear")}
            />}
            rightButton={<IconButton
                aria-label={t("Alerts.All read")}
                children={<AllReadIcon/>}
                onClick={handleAllRead}
                title={t("Alerts.All read")}
            />}
        />
        <Grid container className={classes.center}>
            <AlertsList fetchAlertContent={fetchAlertContent}/>
        </Grid>
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

export default withStyles(styles)(Alerts);
