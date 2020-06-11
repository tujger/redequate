import React, {Suspense} from "react";
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import {BrowserRouter, Route, Switch, withRouter} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {Provider} from "react-redux";
import withWidth from "@material-ui/core/withWidth";
import PropTypes from "prop-types";
import Store from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import {fetchDeviceId, usePages, useFirebase, useStore} from "./controllers/General";
// import ResponsiveDrawerLayout from "./layouts/ResponsiveDrawerLayout";
// import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout";
// import BottomToolbarLayout from "./layouts/BottomToolbarLayout";
import LoadingComponent from "./components/LoadingComponent";
import {matchRole, needAuth, theme as defaultTheme} from "./controllers";
import {watchUserChanged, user} from "./controllers/User";
import {hasNotifications, setupReceivingNotifications} from "./controllers/Notifications";
import {SnackbarProvider} from "notistack";
import {installWrapperControl} from "./controllers/WrapperControl";
import {useDispatch} from "react-redux";
import MainAppbar from "./components/MainAppbar";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout"));

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);
// window.history.pushState(null, null, window.location.href);

const Dispatcher = (props) => {
    const {firebaseConfig, name, theme = defaultTheme, reducers, pages:pagesGiven} = props;
    const [state, setState] = React.useState({store: null});
    const {store, firebase} = state;
    usePages(pagesGiven);
    useStore(store);
    useFirebase(firebase);

    React.useEffect(() => {
        const firebase = Firebase(firebaseConfig);
        installWrapperControl();
        fetchDeviceId();
        if (hasNotifications()) {
            setupReceivingNotifications(firebase).catch(console.error);
        }
        setState({...state, firebase, store: Store(name, reducers)});
        watchUserChanged(firebase);
        // eslint-disable-next-line
    }, []);

    if (!store && !firebase) return <LoadingComponent/>;

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

const DispatcherRoutedBody = withRouter(props => {
    const {pages, menu, width, copyright, headerImage, layout, history, name} = props;
    const dispatch = useDispatch();

    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const updateTitle = (location, action) => {
        const current = (itemsFlat.filter(item => item.route === location.pathname) || [])[0];
        console.log("[Dispatcher]", location);
        if (current) {
            const label = needAuth(current.roles, user)
                ? pages.login.title || pages.login.label : (matchRole(current.roles, user)
                    ? current.title || current.label : pages.notfound.title || pages.notfound.label);
            document.title = label + (name ? " - " + name : "");
            dispatch({type:MainAppbar.LABEL, label});
        }
    }

    React.useEffect(() => {
        updateTitle({pathname: window.location.pathname});
        const currentPathname = window.location.pathname;
        history.replace("/");
        if (currentPathname !== "/") {
            history.push(currentPathname);
        }
        const unlisten = history.listen(updateTitle);
        return () => {
            unlisten();
        }
        // eslint-disable-next-line
    }, []);

    return <Switch>
        <Route
            path={"/*"}
            children={
                layout ? <layout.type
                        copyright={copyright}
                        headerImage={headerImage}
                        menu={menu}
                        store={store}
                        {...layout.props}/>
                    : ((["xs", "sm", "md"].indexOf(width) >= 0) ?
                    (iOS ? <Suspense fallback={<LoadingComponent/>}><BottomToolbarLayout
                            copyright={copyright}
                            headerImage={headerImage}
                            menu={menu}
                            name={name}
                        /></Suspense>
                        : <Suspense fallback={<LoadingComponent/>}><ResponsiveDrawerLayout
                            copyright={copyright}
                            headerImage={headerImage}
                            menu={menu}
                            name={name}
                        /></Suspense>)
                    : <Suspense fallback={<LoadingComponent/>}><TopBottomMenuLayout
                        copyright={copyright}
                        headerImage={headerImage}
                        menu={menu}
                        name={name}
                    /></Suspense>)
            }
        />
    </Switch>
});

Dispatcher.propTypes = {
    firebaseConfig: PropTypes.any,
    headerImage: PropTypes.string,
    layout: PropTypes.any,
    menu: PropTypes.array,
    pages: PropTypes.object,
    copyright: PropTypes.any,
    theme: PropTypes.any,
    reducers: PropTypes.object,
};

export default withWidth()(Dispatcher);
