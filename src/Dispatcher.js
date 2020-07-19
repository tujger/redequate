import React, {Suspense} from "react";
import ThemeProvider from "@material-ui/styles/ThemeProvider";
import {BrowserRouter, Route, Switch, useHistory} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {Provider, useDispatch} from "react-redux";
import withWidth, {isWidthUp, isWidthDown} from "@material-ui/core/withWidth";
import PropTypes from "prop-types";
import Store, {refreshAll} from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import {fetchDeviceId, useFirebase, usePages, useStore, useTechnicalInfo, useWindowData} from "./controllers/General";
// import ResponsiveDrawerLayout from "./layouts/ResponsiveDrawerLayout";
// import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout";
// import BottomToolbarLayout from "./layouts/BottomToolbarLayout";
import LoadingComponent from "./components/LoadingComponent";
import {matchRole, needAuth, theme as defaultTheme} from "./controllers";
import {watchUserChanged, useCurrentUserData, UserData} from "./controllers/UserData";
import {hasNotifications, setupReceivingNotifications} from "./controllers/Notifications";
import {SnackbarProvider} from "notistack";
import {installWrapperControl} from "./controllers/WrapperControl";
import MainAppbar from "./components/MainAppbar";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout"));

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

let oldWidth;
const Dispatcher = (props) => {
    const {firebaseConfig, name, theme = defaultTheme, reducers, pages, width} = props;
    const [state, setState] = React.useState({store: null});
    const {store, firebase} = state;
    useStore(store);
    useFirebase(firebase);
    usePages(pages);
    useTechnicalInfo(state => ({...state, refreshed: new Date().getTime()}));
    const windowData = useWindowData({
        breakpoint: width,
        isNarrow: () => width === "xs" || width === "sm",
    });

    React.useEffect(() => {
        let maintenanceRef;
        (async () => {
            for(let x in pages) {
                pages[x]._route = pages[x].route;
                pages[x].route = pages[x].route.split(/[*:]/)[0];
            }
            const firebase = Firebase(firebaseConfig);
            installWrapperControl();
            fetchDeviceId();
            if (hasNotifications()) {
                setupReceivingNotifications(firebase).catch(console.error);
            }
            const store = Store(name, reducers);
            try {
                const savedUserData = store.getState().currentUserData;
                if(savedUserData && savedUserData.userData) {
                    const userData = new UserData(firebase).fromJSON(savedUserData.userData);
                    await userData.fetch([UserData.ROLE]);
                    useCurrentUserData(userData);
                }
            } catch(error) {
                console.error(error);
            }
            setInterval(() => {
                watchUserChanged(firebase, store);
            }, 30000)
            watchUserChanged(firebase, store);
            maintenanceRef = firebase.database().ref("meta/maintenance");
            maintenanceRef.on("value", snapshot => {
                const maintenance = snapshot.val();
                useTechnicalInfo(currentMeta => {
                    if(currentMeta.maintenance !== maintenance) {
                        console.log("[Dispatcher] maintenance changed to", maintenance);
                        useTechnicalInfo({...currentMeta, maintenance: maintenance});
                        refreshAll(store)
                    }
                    return useTechnicalInfo();
                });
            })
            setState({...state, firebase, store});
        })();
        return () => {
            maintenanceRef && maintenanceRef.off();
        }
        // eslint-disable-next-line
    }, []);

    if (!store || !firebase) return <LoadingComponent/>;

    const onWidthChange = (event) => {
        clearTimeout(widthPoint);
        widthPoint = setTimeout(() => {
            const widths = {1920: "xl", 1280: "lg", 960: "md", 600: "sm", 0: "xs"};
            let newWidth = "xl";
            for(let x in widths) {
                if(window.innerWidth > x) {
                    newWidth = widths[x];
                }
            }
            if(oldWidth !== newWidth) {
                refreshAll(store);
            }
            oldWidth = newWidth;
        }, 50)
    }
    window.addEventListener("resize", onWidthChange);

    return <Provider store={store}>
        <ThemeProvider theme={theme}>
            <SnackbarProvider maxSnack={4} preventDuplicate>
                <BrowserRouter>
                    <DispatcherRoutedBody {...props} theme={theme}/>
                </BrowserRouter>
                <PWAPrompt promptOnVisit={3} timesToShow={3}/>
            </SnackbarProvider>
        </ThemeProvider>
    </Provider>;
};

let widthPoint;
const DispatcherRoutedBody = props => {
    const {pages, menu, width, copyright, headerImage, layout, name, logo} = props;
    const dispatch = useDispatch();
    const history = useHistory();
    const currentUserData = useCurrentUserData();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const updateTitle = (location) => {
        const current = (itemsFlat.filter(item => item.route === location.pathname) || [])[0];
        console.log("[Dispatcher]", location);
        if (current) {
            const label = needAuth(current.roles, currentUserData)
                ? pages.login.title || pages.login.label : (matchRole(current.roles, currentUserData)
                    ? current.title || current.label : pages.notfound.title || pages.notfound.label);
            document.title = label + (name ? " - " + name : "");
            dispatch({type:MainAppbar.LABEL, label});
        }
    }

    React.useEffect(() => {
        updateTitle({pathname: window.location.pathname});
        const currentPathname = window.location.pathname;
        const currentSearch = window.location.search;
        const currentHash = window.location.hash;
        history.replace("/");
        if (currentPathname !== "/") {
            let path = currentPathname;
            if(currentSearch) path += currentSearch;
            if(currentHash) path += currentHash;
            history.push(path);
        }
        const unlisten = history.listen(updateTitle);
        return () => {
            unlisten();
        }
        // eslint-disable-next-line
    }, []);

    const background = history.location.state && history.location.state.background

    return <React.Fragment>
        <Switch location={background}>
        <Route
            path={"/*"}
            children={<Suspense fallback={<LoadingComponent/>}>
                {layout ? <layout.type
                        {...layout.props}
                        copyright={copyright}
                        headerImage={headerImage}
                        menu={menu}
                    />
                    : ((["xs", "sm", "md"].indexOf(width) >= 0) ?
                    (iOS ? <BottomToolbarLayout
                            copyright={copyright}
                            headerImage={headerImage}
                            menu={menu}
                            name={name}
                        />
                        : <ResponsiveDrawerLayout
                            copyright={copyright}
                            headerImage={headerImage}
                            menu={menu}
                            name={name}
                            logo={logo}
                        />)
                    : <TopBottomMenuLayout
                        copyright={copyright}
                        headerImage={headerImage}
                        menu={menu}
                        name={name}
                    />)
                }
            </Suspense>}
        />
    </Switch>
        {background && <Route path={history.location.pathname} children={<div/>} />}
    </React.Fragment>
};

Dispatcher.propTypes = {
    copyright: PropTypes.any,
    firebaseConfig: PropTypes.any.isRequired,
    headerImage: PropTypes.string,
    layout: PropTypes.any,
    menu: PropTypes.array.isRequired,
    logo: PropTypes.any,
    name: PropTypes.string,
    pages: PropTypes.object.isRequired,
    reducers: PropTypes.object,
    theme: PropTypes.any,
};

export default withWidth()(Dispatcher);
