import React from "react";
import {InView} from "react-intersection-observer";
import {Route, Switch, useHistory} from "react-router-dom";
import LoadingComponent from "./LoadingComponent";
import {useMetaInfo, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {matchRole, needAuth, Role as UserData, useCurrentUserData} from "../controllers/UserData";
import {hasWrapperControlInterface, wrapperControlCall} from "../controllers/WrapperControl";
import SystemAlert from "./SystemAlert";

export default props => {
    const currentUserData = useCurrentUserData();
    const history = useHistory();
    const pages = usePages();
    const metaInfo = useMetaInfo();
    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    const isDisabled = metaInfo && metaInfo.maintenance && !matchRole([UserData.ADMIN], currentUserData);

    return <>
        <SystemAlert/>
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
                            {...item.component.props} />
                    }}
                />
            })}</Switch>
        </React.Suspense>}
    </>
};
