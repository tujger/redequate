import React, {Suspense} from "react";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch} from "react-router-dom";
import {matchRole, needAuth, Role as UserData, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useTechnicalInfo} from "../controllers/General";
import TechnicalInfoView from "./TechnicalInfoView";

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

const MainContent = props => {
    const {classes} = props;
    const pages = usePages();
    const technical = useTechnicalInfo();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const currentUserData = useCurrentUserData();

    const isDisabled = technical && technical.maintenance && !matchRole([UserData.ADMIN], currentUserData);

    return <main className={[classes.content].join(" ")}>
        <TechnicalInfoView/>
        {!isDisabled && <Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
                return <Route
                    exact={true}
                    key={index}
                    path={item._route}
                    render={() => {
                        if (!item.component) return null;
                        return needAuth(item.roles, currentUserData)
                            ? <pages.login.component.type {...props} {...pages.login.component.props} />
                            : (matchRole(item.roles, currentUserData) && !item.disabled
                                ? <item.component.type {...props} classes={{}} {...item.component.props} />
                                : <pages.notfound.component.type {...props} {...pages.notfound.component.props} />)
                    }}
                />
            })}</Switch>
        </Suspense>}
        {isDisabled && <Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
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
        </Suspense>}
    </main>
};

export default withStyles(styles)(MainContent);
