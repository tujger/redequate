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
import TopBottomMenuLayout from "./layouts/TopBottomMenuLayout";
import ResponsiveDrawer from "./layouts/ResponsiveDrawer";
import LoadingComponent from "./components/LoadingComponent";
import {theme as defaultTheme} from "./controllers";

const Dispatcher = (props) => {
    const {pages, menu, firebaseConfig, width, name, copyright, theme, reducers, headerImage} = props;
    const [state, setState] = React.useState({firebase: null, store: null});
    const {firebase, store} = state;

    React.useEffect(() => {
        setState({...state, firebase: Firebase(firebaseConfig), store: Store(name, reducers)});
// eslint-disable-next-line
    }, []);

    if(!store) return <LoadingComponent/>;
    return <Provider store={store}>
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
                            (["xs", "sm", "md"].indexOf(width) >= 0) ?
                                <ResponsiveDrawer
                                    copyright={copyright}
                                    firebase={firebase}
                                    headerImage={headerImage}
                                    menu={menu}
                                    pages={pages}
                                    store={store}
                                /> :
                                <TopBottomMenuLayout
                                    copyright={copyright}
                                    firebase={firebase}
                                    headerImage={headerImage}
                                    menu={menu}
                                    pages={pages}
                                    store={store}
                                />
                        }
                    />
                </Switch>
            </BrowserRouter>
            <PWAPrompt promptOnVisit={3} timesToShow={3}/>
        </ThemeProvider>
    </Provider>;
};

Dispatcher.propTypes = {
    firebaseConfig: PropTypes.any,
    headerImage: PropTypes.string,
    menu: PropTypes.array,
    pages: PropTypes.object,
    copyright: PropTypes.string,
    theme: PropTypes.any,
    reducers: PropTypes.object,
};

export default withWidth()(Dispatcher);
