import React, {Suspense} from "react";
import ThemeProvider from '@material-ui/styles/ThemeProvider';
import {BrowserRouter, Route, Switch, withRouter} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {Provider} from "react-redux";
import withWidth from "@material-ui/core/withWidth";
import PropTypes from "prop-types";
import Store from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import {fetchDeviceId} from "./controllers/General";
// import ResponsiveDrawerLayout from "./layouts/ResponsiveDrawerLayout";
// import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout";
// import BottomToolbarLayout from "./layouts/BottomToolbarLayout";
import LoadingComponent from "./components/LoadingComponent";
import {matchRole, needAuth, theme as defaultTheme} from "./controllers";
import {watchUserChanged, user} from "./controllers/User";
import {hasNotifications, setupReceivingNotifications} from "./controllers/Notifications";
import {SnackbarProvider} from "notistack";

const BottomToolbarLayout = React.lazy(() => import("./layouts/BottomToolbarLayout"));
const ResponsiveDrawerLayout = React.lazy(() => import("./layouts/ResponsiveDrawerLayout"));
const TopBottomMenuLayout = React.lazy(() => import("./layouts/TopBottomMenuLayout"));

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);
// window.history.pushState(null, null, window.location.href);

const Dispatcher = (props) => {
    const {firebaseConfig, name, theme = defaultTheme, reducers} = props;
    const [state, setState] = React.useState({firebase: null, store: null});
    const {firebase, store} = state;

    React.useEffect(() => {
        let firebaseInstance = Firebase(firebaseConfig);
        fetchDeviceId();
        if(hasNotifications()) {
            setupReceivingNotifications(firebaseInstance).catch(console.error);
        }
        setState({...state, firebase: firebaseInstance, store: Store(name, reducers)});
        watchUserChanged(firebaseInstance);
  // eslint-disable-next-line
    }, []);

    if(!store && !firebase) return <LoadingComponent/>;

    return <Provider store={store}>
        <ThemeProvider theme={theme}>
            <SnackbarProvider maxSnack={4} preventDuplicate>
                <BrowserRouter>
                    <DispatcherRoutedBody {...props} firebase={firebase} store={store} theme={theme}/>
                </BrowserRouter>
                <PWAPrompt promptOnVisit={3} timesToShow={3}/>
            </SnackbarProvider>
        </ThemeProvider>
    </Provider>;
};

const DispatcherRoutedBody = withRouter(props => {
    const {pages, menu, width, copyright, headerImage, layout, history, firebase, store, name} = props;

    const itemsFlat = Object.keys(pages).map(item => pages[item]);
    const updateTitle = (location, action) => {
        const current = (itemsFlat.filter(item => item.route === location.pathname) || [])[0];
        console.log("[Dispatcher]", location);
        if(current) {
            document.title = (needAuth(current.roles, user)
              ? pages.login.title || pages.login.label : (matchRole(current.roles, user)
                ? current.title || current.label : pages.notfound.title || pages.notfound.label))
            + (name ? " - " + name : "");
        }
    }

    React.useEffect(() => {
        updateTitle({pathname: window.location.pathname});
        const currentPathname = window.location.pathname;
        history.replace("/");
        if(currentPathname !== "/") {
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
                    firebase={firebase}
                    headerImage={headerImage}
                    menu={menu}
                    pages={pages}
                    store={store}
                    {...layout.props}/>
                : ((["xs", "sm", "md"].indexOf(width) >= 0) ?
                    (iOS ? <Suspense fallback={<LoadingComponent/>}><BottomToolbarLayout
                        copyright={copyright}
                        firebase={firebase}
                        headerImage={headerImage}
                        menu={menu}
                        pages={pages}
                        store={store}
                    /></Suspense>
                    : <Suspense fallback={<LoadingComponent/>}><ResponsiveDrawerLayout
                        copyright={copyright}
                        firebase={firebase}
                        headerImage={headerImage}
                        menu={menu}
                        pages={pages}
                        store={store}
                    /></Suspense>)
                    : <Suspense fallback={<LoadingComponent/>}><TopBottomMenuLayout
                        copyright={copyright}
                        firebase={firebase}
                        headerImage={headerImage}
                        menu={menu}
                        pages={pages}
                        store={store}
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
