import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import Typography from "@material-ui/core/Typography";
import {Route, Switch} from "react-router-dom";
import {matchRole, needAuth, Role as UserData, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useTechnicalInfo, checkIfCompatible} from "../controllers/General";
import TechnicalInfoView from "./TechnicalInfoView";

const DeviceUUID = require("device-uuid");

const styles = theme => ({
    content: {
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        maxWidth: "100%",
        padding: theme.spacing(1),
        position: "relative",
        overflow: "auto"
    },
});

const isIncompatible = !checkIfCompatible();

const MainContent = props => {
    const {classes} = props;
    const pages = usePages();
    const technical = useTechnicalInfo();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const currentUserData = useCurrentUserData();

    const isDisabled = technical && technical.maintenance && !matchRole([UserData.ADMIN], currentUserData);

    if (isIncompatible) return <main className={[classes.content].join(" ")}>
        <TechnicalInfoView
            message={<React.Fragment>
                <Typography>Oops, we have detected that your browser is outdated and cannot be supported by GamePal
                    :(</Typography>
                <Typography>We'll be happy to see you back using GamePal with up-to-date browser!</Typography>
            </React.Fragment>}
        />
    </main>

    return <main className={[classes.content].join(" ")}>
        <TechnicalInfoView/>
        {!isDisabled && <React.Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
                return <Route
                    exact={true}
                    key={index}
                    path={item._route}
                    render={() => {
                        return needAuth(item.roles, currentUserData)
                            ? <pages.login.component.type {...props} {...pages.login.component.props} />
                            : (matchRole(item.roles, currentUserData) && !item.disabled && item.component
                                ? <item.component.type {...props} classes={{}} {...item.component.props} />
                                : <pages.notfound.component.type {...props} {...pages.notfound.component.props} />)
                    }}
                />
            })}</Switch>
        </React.Suspense>}
        {isDisabled && <React.Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
                if (!item.component || item.disabled) return null;
                return <Route
                    exact={true}
                    key={index}
                    path={item._route}
                    render={() => {
                        if (item !== pages.login && item !== pages.logout) return null;
                        return <item.component.type {...props} classes={{}} {...item.component.props} />
                    }}
                />
            })}</Switch>
        </React.Suspense>}
    </main>
};

export default withStyles(styles)(MainContent);
