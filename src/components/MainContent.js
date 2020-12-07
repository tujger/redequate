import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import {Route, Switch, useHistory} from "react-router-dom";
import {matchRole, needAuth, Role as UserData, useCurrentUserData} from "../controllers/UserData";
import LoadingComponent from "../components/LoadingComponent";
import {usePages, useTechnicalInfo} from "../controllers/General";
import TechnicalInfoView from "./TechnicalInfoView";
import {InView} from "react-intersection-observer";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import {notifySnackbar} from "../controllers/notifySnackbar";

const styles = theme => ({
    bottom: {},
    bottomSticky: {},
    center: {},
    left: {},
    right: {},
    top: {},
    topSticky: {},
});

const MainContent = props => {
    // eslint-disable-next-line react/prop-types
    const {classes} = props;
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const pages = usePages();
    const technical = useTechnicalInfo();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    const isDisabled = technical && technical.maintenance && !matchRole([UserData.ADMIN], currentUserData);

    return <>
        <TechnicalInfoView/>
        {!isDisabled && <React.Suspense fallback={<LoadingComponent/>}>
            <Switch>{itemsFlat.map((item, index) => {
                return <Route
                    exact={true}
                    key={index}
                    path={item._route}
                    render={() => {
                        if (needAuth(item.roles, currentUserData)) {
                            return <pages.login.component.type
                                {...props}
                                {...pages.login.component.props}
                                onLogin={(isFirstLogin) => {
                                    if (!isFirstLogin) {
                                        history.push(window.location.pathname)
                                        return true;
                                    }
                                }}
                            />
                        }
                        if (matchRole(item.roles, currentUserData)
                            && !item.disabled && item.component) {
                            return <>
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
                                <item.component.type
                                    {...props}
                                    classes={classes}
                                    {...item.component.props}
                                />
                            </>
                        }
                        return <pages.notfound.component.type
                            {...props}
                            {...pages.notfound.component.props}
                        />
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
                        return <item.component.type
                            {...props}
                            classes={classes}
                            {...item.component.props} />
                    }}
                />
            })}</Switch>
        </React.Suspense>}
    </>
};

export default withStyles(styles)(MainContent);
