import "./themes/Base.module.css";
import {DeviceUUID} from "device-uuid";
import {SnackbarProvider} from "notistack";
import React from "react";
import {useTranslation} from "react-i18next";
import PWAPrompt from "react-ios-pwa-prompt";
import {connect, Provider, useDispatch} from "react-redux";
import {BrowserRouter, matchPath, Route, Switch, useHistory} from "react-router-dom";
import {resolveAuth} from "../packages/auth/src";
import {resolveBackend} from "../packages/backend/src";
import {resolveDatabase} from "../packages/database/src";
import {resolveMessaging} from "../packages/messaging/src";
import {resolveStorage} from "../packages/storage/src";
import LoadingComponent from "./components/LoadingComponent";
import SystemAlert from "./components/SystemAlert";
import {useDatabase} from "./controllers";
import AppContext from "./controllers/AppContext/AppContext";
import Firebase from "./controllers/Firebase";
import {
    cacheDatas,
    fetchDeviceId,
    Layout,
    useFirebase,
    useMetaInfo,
    usePages,
    useStore,
    useWindowData
} from "./controllers/General";
import {setupReceivingNotifications} from "./controllers/Notifications";
import notifySnackbar from "./controllers/notifySnackbar";
import {checkForUpdate} from "./controllers/ServiceWorkerControl";
import Store, {refreshAll} from "./controllers/Store";
import textTranslation, {useTextTranslation} from "./controllers/textTranslation";
import {getCurrentUserData, useCurrentUserDataValue, useSetCurrentUserData} from "./controllers/useCurrentUserData";
import {matchRole, needAuth, UserData, watchUserChanged} from "./controllers/UserData";
import {installWrapperControl} from "./controllers/WrapperControl";
import Button from "./controls/Button/Button";
import initInternationalization from "./helpers/initInternationalization";
import useBreakpoint from "./helpers/useBreakpoint";
import {getScrollPosition} from "./helpers/useScrollPosition";
import {restoreLanguage} from "./reducers/languageReducer";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout/TopBottomMenuLayout"));

const iOS = typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const installConsoleError = database => {
    const origin = console.error;
    const reportError = error => origin.call(console, error);
    const handler = function (...args) {
        origin.call(console, ...args);
        try {
            if (args.length !== 1) return;
            const message = String(args[0]);
            if (["no such file or directory", "Module not found", "memory access out of bounds"].some(filter => message.includes(filter))) return;

            if (!database) {
                reportError("[Dispatcher] Error was not saved: database is unavailable.");
                return;
            }
            const currentUserData = getCurrentUserData();
            const saving = database.create(["errors", "error_id"], {
                error: String(args[0]?.stack || message),
                timestamp: database.TIMESTAMP,
                uid: currentUserData?.id || "anonymous"
            });
            Promise.resolve(saving).catch(reportError);
        } catch (error) {
            reportError(error);
        }
    };
    console.error = handler;
    return () => {
        if (console.error === handler) console.error = origin;
    };
};

export default (props) => {
    const {
        auth: authGiven,
        backend: backendGiven,
        database: databaseGiven,
        firebase: firebaseGiven = undefined,
        firebaseConfig = undefined,
        locales,
        messaging: messagingGiven,
        pages: pagesGiven,
        title,
        reducers,
        storage: storageGiven,
        width: widthGiven
    } = props;
    const width = useBreakpoint(widthGiven);
    const [state, setState] = React.useState({store: null});
    const widthRef = React.useRef(width);
    const previousWidth = React.useRef(width);
    const {firebase} = state;
    const setCurrentUserData = useSetCurrentUserData();
    widthRef.current = width;

    React.useEffect(() => {
        if (previousWidth.current !== width) {
            previousWidth.current = width;
            if (state.store) refreshAll(state.store);
        }
    }, [width, state.store]);

    React.useEffect(() => {
        let maintenanceRef, metaListener;
        let consoleHandler;
        const clearOneTapCookie = async props => {
            document.cookie = "g_state=''";
            return props;
        }
        const initFirebase = async props => {
            const firebase = firebaseGiven || Firebase(firebaseConfig);
            console.log("[Dispatcher]", "firebase resolved", {firebase});
            return {...props, firebase};
        }
        const initDatabase = async props => {
            try {
                const database = await resolveDatabase(databaseGiven);
                consoleHandler = installConsoleError(database);
                console.log("[Dispatcher]", "database resolved", {database});
                return {...props, consoleHandler, database};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initAuth = async props => {
            try {
                const auth = await resolveAuth(authGiven, {database: props.database, UserData});
                console.log("[Dispatcher]", "auth resolved", {auth});
                return {...props, auth};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initBackend = async props => {
            try {
                const backend = await resolveBackend(backendGiven);
                console.log("[Dispatcher]", "backend resolved", {backend});
                return {...props, backend};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initMessaging = async props => {
            try {
                const messaging = await resolveMessaging(messagingGiven);
                console.log("[Dispatcher]", "messaging resolved", {messaging});
                return {...props, messaging};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initStorage = async props => {
            try {
                const storage = await resolveStorage(storageGiven);
                console.log("[Dispatcher]", "storage resolved", {storage});
                return {...props, storage};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initStore = async props => {
            return {...props, store: Store(title, reducers)};
        }
        const restoreAuth = async props => {
            try {
                const authUser = await props.auth.resolveCurrentUser();
                return {...props, authUser};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const initWindowData = async props => {
            const windowData = {
                get breakpoint() {
                    return widthRef.current;
                },
                isNarrow: () => widthRef.current === "xs" || widthRef.current === "sm",
                isWide: () => widthRef.current === "md" || widthRef.current === "lg" || widthRef.current === "xl",
            }
            return {...props, windowData};
        }
        const initTextTranslation = async props => {
            const textTranslationInstance = textTranslation({firebase});
            return {...props, textTranslation: textTranslationInstance};
        }
        const fetchDeviceId_ = async props => {
            return {...props, deviceId: fetchDeviceId()};
        }
        const checkIfCompatible = async props => {
            const {t} = props;
            try {
                const deviceUUID = new DeviceUUID();
                const deviceMeta = deviceUUID.parse();
                const browser = deviceMeta.browser.toLowerCase();
                const version = parseInt(deviceMeta.version);

                if (browser === "edge" && version < 18) {
                    throw Error(t("Oops, we have detected that your browser is outdated and cannot be supported by {{title}}\nWe'll be happy to see you back using {{title}} with up-to-date browser!", {title: t(title)}));
                }
                // if (browser === "chrome") throw Error("incompatible");
            } catch (error) {
                console.error(error);
                throw {...props, fatal: error};
            }
            return props;
        }
        const fetchMetaInfo = async props => {
            const {database} = props;
            const settings = (await database.read(["meta", {"settings": "settings"}])) || {};
            return {...props, metaInfo: {settings}};
        }
        const fetchCurrentUserData = async props => {
            const {authUser, database, deviceId} = props;
            if (!authUser?.id) {
                setCurrentUserData(authUser);
                return props;
            }
            try {
                // eslint-disable-next-line react/prop-types -- authUser is a provider model.
                const userData = new UserData(database).fromJSON(authUser.toJSON());
                await userData.fetch([UserData.PUBLIC, UserData.ROLE, UserData.FORCE]);
                await userData.fetchPrivate(deviceId, true);
                return {...props, userData};
            } catch (error) {
                throw {...props, fatal: error};
            }
        }
        const fetchCurrentUserLastVisit = async props => {
            const {userData} = props;
            if (userData) {
                userData.lastVisit = +(window.localStorage.getItem(title + "_last") || 0);
                cacheDatas.put(userData.id, userData);
                setCurrentUserData(userData);
            }
            return props;
        }
        const changeCurrentLanguage = async props => {
            const {deviceId, i18n, store, userData} = props;
            if (!i18n) return props;
            if (userData && userData.private[deviceId]) {
                const pvt = userData.private[deviceId];
                i18n.changeLanguage(pvt.locale);
            } else {
                restoreLanguage(i18n);
            }
            return props;
        }
        const initPagesBuilder = async props => {
            const buildPages = () => {
                const {t} = props;
                const pages = pagesGiven(t);
                for (const x in pages) {
                    pages[x]._route = pages[x].route;
                    pages[x].route = pages[x].route.split(/[*:]/)[0];
                }
                return pages;
            }
            return {...props, buildPages};
        }
        const updateState = async props => {
            setState(state => ({...state, ...props}));
            return props;
        }
        const installWrapperControl_ = async props => {
            (async () => {
                installWrapperControl(props._firebase);
            })().catch(notifySnackbar);
            return props;
        }
        const installNotificationsWatcher = async initialization => {
            (async () => {
                if (!iOS && await initialization.messaging.checkIfSubscribed()) {
                    setupReceivingNotifications(initialization.messaging).catch(console.error);
                }
            })().catch(console.error);
            return initialization;
        }
        const installUserChangeWatcher = async props => {
            (async () => {
                const {auth, database, store} = props;
                setInterval(() => {
                    watchUserChanged({
                        auth,
                        database,
                        getUserData: getCurrentUserData,
                        onUserChanged: setCurrentUserData
                    }).then(() => refreshAll(store));
                }, 30000)
                watchUserChanged({
                    auth,
                    database,
                    getUserData: getCurrentUserData,
                    onUserChanged: setCurrentUserData
                }).then(() => refreshAll(store));
            })().catch(console.error);
            return props;
        }
        const installMetaWatcher = async props => {
            (async () => {
                const {database, firebase, store, t} = props;
                let initial = true;
                metaListener = database.addEventListener(["meta"], {
                    onChange(meta) {
                        const {maintenance, settings} = meta || {};
                        if (initial) {
                            initial = false;
                        } else {
                            console.warn("[Dispatcher] meta changed", meta);
                            setState(state => ({...state, metaInfo: {settings}}));
                            refreshAll(store);
                            notifySnackbar(t("Reloaded due to settings changed"));
                        }
                        setState(state => {
                            const metaInfo = state.metaInfo || {};
                            if (JSON.stringify(maintenance || null) !== JSON.stringify(metaInfo.maintenance || null)) {
                                console.warn("[Dispatcher] maintenance changed to", maintenance || "none");
                                return {...state, metaInfo: {...metaInfo, maintenance}};
                            }
                            return state;
                        })
                    }
                })
            })().catch(console.error);
            return props;
        }
        const installLastVisitSaver = async props => {
            (async () => {
                window.addEventListener("beforeunload", event => {
                    window.localStorage.setItem(title + "_last", new Date().getTime());
                });
            })().catch(console.error);
            return props;
        }
        const installApplicationVisibilityChecker = async props => {
            const {store} = props;
            const refreshNeeded = () => {
                const position = getScrollPosition({});
                if (position.y === 0) {
                    store.dispatch({type: Layout.REFRESH_CONTENT});
                    checkForUpdate(false).then(console.log).catch(console.error);
                }
            }
            (async () => {
                window.addEventListener("pageshow", () => {
                    refreshNeeded();
                })
            })().catch(console.error);
            (async () => {
                document.addEventListener("visibilitychange", event => {
                    if (document.visibilityState === "visible") {
                        refreshNeeded();
                    }
                })
            })().catch(console.error);
        }
        const onError = async error => {
            console.error(error);
            if (error.fatal) {
                setState(state => ({...state, fatal: error.fatal}));
            } else {
                setState(state => ({...state, ...error}));
            }
        }
        const printProps = async props => {
            console.log(props);
            return props
        }

        initInternationalization(title, locales)
            .then(clearOneTapCookie)
            .then(initFirebase)
            .then(initDatabase)
            .then(initAuth)
            .then(initBackend)
            .then(initMessaging)
            .then(initStorage)
            .then(initStore)
            .then(restoreAuth)
            .then(initWindowData)
            .then(initTextTranslation)
            .then(fetchDeviceId_)
            .then(checkIfCompatible)
            .then(fetchMetaInfo)
            .then(fetchCurrentUserData)
            .then(fetchCurrentUserLastVisit)
            .then(changeCurrentLanguage)
            .then(initPagesBuilder)
            // .then(printProps)
            .then(updateState)
            .then(installWrapperControl_)
            .then(installNotificationsWatcher)
            .then(installUserChangeWatcher)
            .then(installMetaWatcher)
            .then(installLastVisitSaver)
            .then(installApplicationVisibilityChecker)
            .catch(onError);

        return () => {
            maintenanceRef && maintenanceRef.off();
            metaListener?.remove();
            consoleHandler?.();
        }
        // eslint-disable-next-line
    }, []);

    if (state.fatal) return <DispatcherInitializationError error={state.fatal} theme={props.theme}/>;

    if (!firebase) return <LoadingComponent/>;

    return <DispatcherInitialized
        {...props}
        {...state}
        width={width}
    />
}

const DispatcherInitializationError = ({error, theme}) => {
    const {t} = useTranslation();
    return <>
        {theme}
        <SystemAlert message={error.message}/>
        <Button onClick={() => window.location.reload()}>{t("Refresh")}</Button>
    </>;
}

const DispatcherInitialized = (props) => {
    const {
        auth,
        backend,
        buildPages,
        copyright,
        database,
        firebase,
        store,
        menu: givenMenu,
        messaging,
        storage,
        theme,
        title,
        textTranslation,
        windowData,
        metaInfo
    } = props;
    const {t} = useTranslation();

    useFirebase(firebase);
    useMetaInfo(metaInfo);
    useStore(store);
    useTextTranslation(textTranslation);
    useWindowData(windowData);
    const pages = usePages(buildPages ? buildPages() : {});
    const menu = givenMenu(pages);

    console.log("[Context]", {auth, backend, database, messaging, storage});

    return <AppContext value={{auth, backend, database, messaging, storage}}>
        <Provider store={store}>
            <>
                {theme}
                <BrowserRouter>
                    <SnackbarProvider maxSnack={4} preventDuplicate>
                        <DispatcherRoutedBody
                            {...props}
                            copyright={t(copyright, {version: process.env.REACT_APP_VERSION})}
                            menu={menu}
                            title={t(title)}
                        />
                    </SnackbarProvider>
                </BrowserRouter>
                <PWAPrompt promptOnVisit={3} timesToShow={3}/>
            </>
        </Provider>
    </AppContext>
}

const mapStateToProps = ({dispatcherRoutedBodyReducer}) => ({random: dispatcherRoutedBodyReducer.random});

const DispatcherRoutedBody = connect(mapStateToProps)((props) => {
    const {
        menu,
        width,
        copyright,
        footerComponent,
        headerComponent,
        layout,
        title,
        logo,
        random,
        iosLayout = true
    } = props;
    const currentUserData = useCurrentUserDataValue();
    const database = useDatabase();
    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const {t} = useTranslation();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);

    React.useEffect(() => {
        const updateTitle = (location) => {
            console.log("[Dispatcher]", JSON.stringify(location));
            try {
                if (currentUserData.id) {
                    currentUserData.updateVisitTimestamp(database);
                }
            } catch (error) {
                console.error(error);
            }
            let titleLabel = title;
            if (history.action === "POP") {

            } else {
                const currentPage = (itemsFlat.filter(item => matchPath(location.pathname, {
                    exact: true,
                    path: item._route,
                })) || [])[0];

                if (currentPage) {
                    const allowed = needAuth(currentPage.roles, currentUserData)
                        ? pages.login
                        : (matchRole(currentPage.roles, currentUserData) && !currentPage.disabled && currentPage.component)
                            ? currentPage : pages.notfound;
                    titleLabel = t(allowed.title || allowed.label);
                }
            }
            document.title = titleLabel + (title && title !== titleLabel ? " - " + title : "");
            dispatch({type: Layout.TITLE, label: titleLabel});
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
                            footerComponent={footerComponent}
                            headerComponent={headerComponent}
                            logo={logo}
                            menu={menu}
                            title={title}
                        />
                        : ((["xs", "sm", "md"].indexOf(width) >= 0)
                            ? ((iOS && iosLayout)
                                ? <BottomToolbarLayout
                                    copyright={copyright}
                                    footerComponent={footerComponent}
                                    headerComponent={headerComponent}
                                    menu={menu}
                                    title={title}
                                />
                                : <ResponsiveDrawerLayout
                                    copyright={copyright}
                                    footerComponent={footerComponent}
                                    headerComponent={headerComponent}
                                    logo={logo}
                                    menu={menu}
                                    title={title}
                                />)
                            : <TopBottomMenuLayout
                                copyright={copyright}
                                footerComponent={footerComponent}
                                headerComponent={headerComponent}
                                menu={menu}
                                title={title}
                            />)
                    }
                </React.Suspense>}
            />
        </Switch>
        {itemsFlat.map((item, index) => {
            if (!item.daemon || !item.component || item.disabled) return null;
            if (!matchRole(item.roles, currentUserData)) return null;
            return <item.component.type
                key={item.route}
                {...props}
                {...item.component.props}
                daemon
            />
        })}
        {background && <Route path={history.location.pathname} children={<div/>}/>}
    </React.Fragment>
});

export {useTranslation};
