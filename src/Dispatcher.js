import React from "react";
import ThemeProvider from "@material-ui/styles/ThemeProvider";
// import BottomToolbarLayout from "./layouts/BottomToolbarLayout/BottomToolbarLayout";
// import ResponsiveDrawerLayout from "./layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout";
// import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout/TopBottomMenuLayout";
import {BrowserRouter, matchPath, Route, Switch, useHistory} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {connect, Provider, useDispatch} from "react-redux";
import withWidth from "@material-ui/core/withWidth";
import Typography from "@material-ui/core/Typography";
import PropTypes from "prop-types";
import Store, {refreshAll} from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import {
    cacheDatas,
    checkIfCompatible,
    fetchDeviceId,
    Layout,
    useFirebase,
    usePages,
    useStore,
    useTechnicalInfo,
    useWindowData
} from "./controllers/General";
import LoadingComponent from "./components/LoadingComponent";
import {matchRole, needAuth, useCurrentUserData, UserData, watchUserChanged} from "./controllers/UserData";
import {colors, createTheme} from "./controllers/Theme";
import {hasNotifications, setupReceivingNotifications} from "./controllers/Notifications";
import {SnackbarProvider} from "notistack";
import {installWrapperControl} from "./controllers/WrapperControl";
import TechnicalInfoView from "./components/TechnicalInfoView";
import {Pages} from "./proptypes/Pages";
import {Page} from "./proptypes";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout/TopBottomMenuLayout"));

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

const origin = console.error;
console.error = function (...args) {
    origin.call(this, ...args);
    // return;
    try {
        if (!args.length || args.length > 1) return;
        if (args[0].toString().indexOf("provided to the classes prop") > 1) {
            return;
        }
        if (args[0].toString().indexOf("`styles` argument provided") > 1) {
            return;
        }
        if (args[0].toString().indexOf("no such file or directory") > 1) {
            return;
        }
        if (args[0].toString().indexOf("memory access out of bounds") > 1) {
            return;
        }
        const firebase = useFirebase();
        const currentUserData = useCurrentUserData();
        if (!firebase || !firebase.database) return;
        firebase.database().ref("errors").push({
            error: args[0].stack || args[0],
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            uid: currentUserData.id || "anonymous"
        });
    } catch (error) {
        origin.call(this, error);
    }
}

const isIncompatible = !checkIfCompatible();

let oldWidth;

function Dispatcher(props) {
    const {firebaseConfig, title, theme = createTheme({colors: colors()}), reducers, pages, width} = props;
    const [state, setState] = React.useState({store: null});
    const {store, firebase} = state;
    useFirebase(firebase);
    usePages(pages);
    useStore(store);
    useTechnicalInfo(state => ({
        ...state,
        maintenance: null,
        refreshed: new Date().getTime(),
        title: title,
    }));
    useWindowData({
        breakpoint: width,
        isNarrow: () => width === "xs" || width === "sm"
    });

    React.useEffect(() => {
        if (isIncompatible) return;
        window.addEventListener("beforeunload", event => {
            window.localStorage.setItem(title + "_last", new Date().getTime());
        })
        let maintenanceRef;
        (async () => {
            try {
                for (let x in pages) {
                    pages[x]._route = pages[x].route;
                    pages[x].route = pages[x].route.split(/[*:]/)[0];
                }
                const firebase = Firebase(firebaseConfig);
                installWrapperControl(firebase);
                fetchDeviceId();
                if (hasNotifications()) {
                    setupReceivingNotifications(firebase).catch(console.error);
                }
                const store = Store(title, reducers);
                try {
                    const savedUserData = store.getState().currentUserData;
                    if (savedUserData && savedUserData.userData) {
                        const userData = new UserData(firebase).fromJSON(savedUserData.userData);
                        await userData.fetch([UserData.ROLE]);
                        await userData.fetchPrivate(fetchDeviceId(), true);
                        userData.lastVisit = +(window.localStorage.getItem(title + "_last") || 0);
                        useCurrentUserData(userData);
                        cacheDatas.put(userData.id, userData);
                    }
                } catch (error) {
                    console.error(error);
                }
                setInterval(() => {
                    watchUserChanged(firebase, store).then(() => refreshAll(store));
                }, 30000)
                watchUserChanged(firebase, store).then(() => refreshAll(store));
                maintenanceRef = firebase.database().ref("meta/maintenance");
                maintenanceRef.on("value", snapshot => {
                    const maintenance = snapshot.val();
                    console.log(`[Dispatcher] maintenance: ${JSON.stringify(maintenance)}`)
                    useTechnicalInfo(currentMeta => {
                        if (currentMeta.maintenance !== maintenance) {
                            console.log("[Dispatcher] maintenance changed to", maintenance);
                            useTechnicalInfo({...currentMeta, maintenance: maintenance});
                            refreshAll(store)
                        }
                        return useTechnicalInfo();
                    });
                });
                setState(state => ({...state, firebase, store}));
            } catch (e) {
                console.error(e);
            }
        })();
        return () => {
            maintenanceRef && maintenanceRef.off();
        }
        // eslint-disable-next-line
    }, []);

    if (isIncompatible) {
        return <ThemeProvider theme={theme}><TechnicalInfoView
            message={<>
                <Typography>Oops, we have detected that your browser is outdated and cannot be supported
                    by {title} :(</Typography>
                <Typography>We'll be happy to see you back using {title} with up-to-date browser!</Typography>
            </>}
        /></ThemeProvider>
    }

    if (!store || !firebase) return <LoadingComponent/>;

    const onWidthChange = (event) => {
        clearTimeout(widthPoint);
        widthPoint = setTimeout(() => {
            const widths = {1920: "xl", 1280: "lg", 960: "md", 600: "sm", 0: "xs"};
            let newWidth = "xl";
            for (let x in widths) {
                if (window.innerWidth > x) {
                    newWidth = widths[x];
                }
            }
            if (oldWidth && oldWidth !== newWidth) {
                refreshAll(store);
            }
            oldWidth = newWidth;
        }, 50)
    }
    window.addEventListener("resize", onWidthChange);

    return <Provider store={store}>
        <ThemeProvider theme={theme}>
            <BrowserRouter>
                <SnackbarProvider maxSnack={4} preventDuplicate>
                    <DispatcherRoutedBody {...props} theme={theme}/>
                </SnackbarProvider>
            </BrowserRouter>
            <PWAPrompt promptOnVisit={3} timesToShow={3}/>
        </ThemeProvider>
    </Provider>;
}

let widthPoint;

function _DispatcherRoutedBody(props) {
    // eslint-disable-next-line react/prop-types
    const {pages, menu, width, copyright, headerComponent, layout, title, logo, random} = props;
    const dispatch = useDispatch();
    const history = useHistory();
    const currentUserData = useCurrentUserData();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    React.useEffect(() => {
        const updateTitle = (location) => {
            console.log("[Dispatcher]", JSON.stringify(location));
            try {
                if (currentUserData && currentUserData.id) currentUserData.updateVisitTimestamp();
            } catch (error) {
                console.error(error);
            }
            const currentPage = (itemsFlat.filter(item => matchPath(location.pathname, {
                exact: true,
                path: item._route,
            })) || [])[0];

            if (currentPage) {
                const allowed = needAuth(currentPage.roles, currentUserData) ? pages.login : (matchRole(currentPage.roles, currentUserData) && !currentPage.disabled && currentPage.component) ? currentPage : pages.notfound;
                const label = allowed.title || allowed.label;
                document.title = label + (title ? " - " + title : "");
                dispatch({type: Layout.TITLE, label});
            }
        }

        updateTitle({pathname: window.location.pathname});
        const currentPathname = window.location.pathname;
        const currentSearch = window.location.search;
        const currentHash = window.location.hash;
        history.replace("/");
        if (currentPathname !== "/") {
            let path = currentPathname;
            if (currentSearch) path += currentSearch;
            if (currentHash) path += currentHash;
            history.push(path);
        }
        const unlisten = history.listen(updateTitle);
        return () => {
            unlisten();
        }
        // eslint-disable-next-line
    }, [currentUserData]);

    const background = history.location.state && history.location.state.background

    return <React.Fragment key={random}>
        <Switch location={background}>
            <Route
                path={"/*"}
                children={<React.Suspense fallback={<LoadingComponent/>}>
                    {layout
                        ? <layout.type
                            {...layout.props}
                            copyright={copyright}
                            headerComponent={headerComponent}
                            logo={logo}
                            menu={menu}
                            title={title}
                        />
                        : ((["xs", "sm", "md"].indexOf(width) >= 0)
                            ? (iOS
                                ? <BottomToolbarLayout
                                    copyright={copyright}
                                    headerComponent={headerComponent}
                                    menu={menu}
                                    title={title}
                                />
                                : <ResponsiveDrawerLayout
                                    copyright={copyright}
                                    headerComponent={headerComponent}
                                    logo={logo}
                                    menu={menu}
                                    title={title}
                                />)
                            : <TopBottomMenuLayout
                                copyright={copyright}
                                headerComponent={headerComponent}
                                menu={menu}
                                title={title}
                            />)
                    }
                </React.Suspense>}
            />
        </Switch>
        {itemsFlat.map((item, index) => {
            if (!item.daemon || !item.component || item.disabled || isIncompatible) return null;
            if (!matchRole(item.roles, currentUserData)) return null;
            return <item.component.type
                key={item.route}
                {...props}
                classes={{}}
                {...item.component.props}
                daemon
            />
        })}
        {background && <Route path={history.location.pathname} children={<div/>}/>}
    </React.Fragment>
}

_DispatcherRoutedBody.propTypes = {
    layout: PropTypes.any,
    pages: PropTypes.objectOf(Pages).isRequired,
};

const mapStateToProps = ({dispatcherRoutedBodyReducer}) => ({random: dispatcherRoutedBodyReducer.random});

const DispatcherRoutedBody = connect(mapStateToProps)(_DispatcherRoutedBody);

Dispatcher.propTypes = {
    copyright: PropTypes.any,
    firebaseConfig: PropTypes.any.isRequired,
    layout: PropTypes.any,
    menu: PropTypes.arrayOf(PropTypes.arrayOf(Page)).isRequired,
    logo: PropTypes.any,
    title: PropTypes.string.isRequired,
    pages: PropTypes.objectOf(Pages).isRequired,
    reducers: PropTypes.object,
    theme: PropTypes.any,
    width: PropTypes.string,
};

export default withWidth()(Dispatcher);
