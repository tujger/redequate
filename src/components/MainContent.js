import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch} from "react-router-dom";
import {matchRole, needAuth, Role as UserData, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useTechnicalInfo} from "../controllers/General";
import TechnicalInfoView from "./TechnicalInfoView";
import {InView} from "react-intersection-observer";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import {notifySnackbar} from "../controllers/notifySnackbar";

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
    // eslint-disable-next-line react/prop-types
    const {classes} = props;
    const pages = usePages();
    const technical = useTechnicalInfo();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const currentUserData = useCurrentUserData();

    const isDisabled = technical && technical.maintenance && !matchRole([UserData.ADMIN], currentUserData);

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
                                ? <React.Fragment>
                                    {hasWrapperControlInterface() && <InView
                                        children={null}
                                        onChange={(inView) => {
                                            let swipeable = inView;
                                            if (item.pullToRefresh === false) swipeable = false;
                                            wrapperControlCall({
                                                method: "swipeable",
                                                value: swipeable
                                            }).catch(notifySnackbar)
                                        }}
                                    />}
                                    <item.component.type {...props} classes={{}} {...item.component.props} />
                                </React.Fragment>
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
