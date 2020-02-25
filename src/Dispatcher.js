import React from "react";
import {ThemeProvider} from '@material-ui/core/styles';
import {BrowserRouter, Switch} from "react-router-dom";
import PWAPrompt from "react-ios-pwa-prompt";
import {Provider} from "react-redux";
import Route from "react-router-hooks";
import {withWidth} from "@material-ui/core";
import PropTypes from "prop-types";
import Store from "./controllers/Store";
import Firebase from "./controllers/Firebase";
import ResponsiveDrawerLayout from "./layouts/ResponsiveDrawerLayout";
import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout";
import TopBottomToolbarLayout from "./layouts/TopBottomToolbarLayout";
import LoadingComponent from "./components/LoadingComponent";
import {theme as defaultTheme} from "./controllers";
import {watchUserChanged} from "./controllers/User";
import {setupReceivingNotifications} from "./controllers/PushNotifications";
import { SnackbarProvider } from "notistack";

const iOS = process.browser && /iPad|iPhone|iPod/.test(navigator.userAgent);
window.history.pushState(null, null, window.location.href);

const Dispatcher = (props) => {
    const {pages, menu, firebaseConfig, width, name, copyright, theme, reducers, headerImage, layout} = props;
    const [state, setState] = React.useState({firebase: null, store: null});
    const {firebase, store} = state;

    React.useEffect(() => {
        let firebaseInstance = Firebase(firebaseConfig);
        setupReceivingNotifications(firebaseInstance);
        setState({...state, firebase: firebaseInstance, store: Store(name, reducers)});
        watchUserChanged(firebaseInstance);
// eslint-disable-next-line
    }, []);

    if(!store) return <LoadingComponent/>;
    return <Provider store={store}>
      <SnackbarProvider maxSnack={4} preventDuplicate>
        <ThemeProvider theme={theme || defaultTheme}>
            <BrowserRouter>
                <Switch>
                    <Route
                        children={
                            <props.pages.test.component.type
                                {...props}
                                {...pages.test.component.props}
                                firebase={firebase}/>}
                        exact={true}
                        path={pages.test.route}
                    />
                    <Route
                        path={"/*"}
                        children={
                            layout ? <layout.type copyright={copyright}
                                                    firebase={firebase}
                                                    headerImage={headerImage}
                                                    menu={menu}
                                                    pages={pages}
                                                    store={store}
                                                    {...layout.props}/>
                              : ((["xs", "sm", "md"].indexOf(width) >= 0) ?
                              (iOS ? <TopBottomToolbarLayout
                                  copyright={copyright}
                                  firebase={firebase}
                                  headerImage={headerImage}
                                  menu={menu}
                                  pages={pages}
                                  store={store}
                                />
                                : <ResponsiveDrawerLayout
                                    copyright={copyright}
                                    firebase={firebase}
                                    headerImage={headerImage}
                                    menu={menu}
                                    pages={pages}
                                    store={store}
                                />) :
                                <TopBottomMenuLayout
                                    copyright={copyright}
                                    firebase={firebase}
                                    headerImage={headerImage}
                                    menu={menu}
                                    pages={pages}
                                    store={store}
                                />)
                        }
                    />
                </Switch>
            </BrowserRouter>
            <PWAPrompt promptOnVisit={3} timesToShow={3}/>
        </ThemeProvider>
      </SnackbarProvider>
    </Provider>;
};

Dispatcher.propTypes = {
    firebaseConfig: PropTypes.any,
    headerImage: PropTypes.string,
    layout: PropTypes.any,
    menu: PropTypes.array,
    pages: PropTypes.object,
    copyright: PropTypes.string,
    theme: PropTypes.any,
    reducers: PropTypes.object,
};

export default withWidth()(Dispatcher);
