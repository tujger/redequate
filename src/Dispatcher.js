import React, {Suspense} from "react";
import ThemeProvider from "@material-ui/styles/ThemeProvider";
import {BrowserRouter, Route, Switch, useHistory} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {connect, Provider, useDispatch} from "react-redux";
import withWidth from "@material-ui/core/withWidth";
import PropTypes from "prop-types";
import Store, {refreshAll} from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import {
    cacheDatas,
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
import {default as defaultTheme} from "./controllers/Theme";
import {hasNotifications, setupReceivingNotifications} from "./controllers/Notifications";
import {SnackbarProvider} from "notistack";
import {installWrapperControl} from "./controllers/WrapperControl";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout/TopBottomMenuLayout"));

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

const origin = console.error;
console.error = function(...args) {
    origin.call(this, ...args);
    if(args.length > 1) return;
    // return;
    try {
        const firebase = useFirebase();
        const currentUserData = useCurrentUserData();
        firebase.database().ref("errors").push({
            error: args[0].stack || args[0],
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            uid: currentUserData.id
        });
    } catch(error) {
        origin.call(this, error);
    }
}

let oldWidth;
function Dispatcher(props) {
    const {firebaseConfig, name, theme = defaultTheme, reducers, pages, width} = props;
    const [state, setState] = React.useState({store: null});
    const {store, firebase} = state;
    useStore(store);
    useFirebase(firebase);
    usePages(pages);
    useTechnicalInfo(state => ({...state, name: name, maintenance: null, refreshed: new Date().getTime()}));
    const windowData = useWindowData({
        breakpoint: width,
        isNarrow: () => width === "xs" || width === "sm",
    });

    React.useEffect(() => {
        let maintenanceRef;
        (async () => {
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
            const store = Store(name, reducers);
            try {
                const savedUserData = store.getState().currentUserData;
                if (savedUserData && savedUserData.userData) {
                    const userData = new UserData(firebase).fromJSON(savedUserData.userData);
                    await userData.fetch([UserData.ROLE]);
                    await userData.fetchPrivate(fetchDeviceId());
                    useCurrentUserData(userData);
                    cacheDatas.put(userData.id, userData);
                }
            } catch (error) {
                console.error(error);
            }
            setInterval(() => {
                watchUserChanged(firebase, store, () => refreshAll(store));
            }, 30000)
            watchUserChanged(firebase, store, () => refreshAll(store));
            maintenanceRef = firebase.database().ref("meta/maintenance");
            maintenanceRef.on("value", snapshot => {
                const maintenance = snapshot.val();
                useTechnicalInfo(currentMeta => {
                    if (currentMeta.maintenance !== maintenance) {
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
    const {pages, menu, width, copyright, headerComponent, headerImage, layout, name, logo, random} = props;
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
            dispatch({type: Layout.TITLE, label});
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
            if (currentSearch) path += currentSearch;
            if (currentHash) path += currentHash;
            history.push(path);
        }
        const unlisten = history.listen(updateTitle);
        return () => {
            unlisten();
        }
        // eslint-disable-next-line
    }, []);

    const background = history.location.state && history.location.state.background

    return <React.Fragment key={random}>
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
                                headerComponent={headerComponent}
                                headerImage={headerImage}
                                menu={menu}
                                name={name}
                            />)
                    }
                </Suspense>}
            />
        </Switch>
        {itemsFlat.map((item, index) => {
            if (!item.daemon || !item.component || item.disabled) return null;
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

const mapStateToProps = ({dispatcherRoutedBodyReducer}) => ({random: dispatcherRoutedBodyReducer.random});

const DispatcherRoutedBody = connect(mapStateToProps)(_DispatcherRoutedBody);

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
