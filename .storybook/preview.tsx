import {CssBaseline, StyledEngineProvider} from "@mui/material";
import {SnackbarProvider} from "notistack";
import React from "react";
import {Provider} from "react-redux";
import {BrowserRouter} from "react-router-dom";
import "../src/styles.css";
import {store} from "./store";
import {Dispatcher} from "../src";
import Search from "../src/pages/search/Search";
import {Search as SearchIcon} from "@mui/icons-material";
import firebaseConfig from "./firebase-config.json";

export default {
    parameters: {
        // actions: {argTypesRegex: "^on[A-Z].*"},
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
    decorators: [
        (Story) => {
            // const store = Store("storybook", []);
            return (
                <Provider store={store}>
                    <Deco>
                        <Story/>
                    </Deco>
                </Provider>
            );
        },
    ]
};


const Deco = ({children, ...props}) => {
    // const theme = createTheme({colors: colors()});
    // const pages = usePages(buildPages ? buildPages() : {});
    console.log(props);
    const pages = (t) => ({
        page: {
            route: "/iframe.html",
            label: "Page",
            icon: <SearchIcon/>,
            component: <Page>{children}</Page>
        },
    })
    return <Dispatcher
        {...props}
        copyright={null}
        headerComponent={<div/>}
        firebaseConfig={firebaseConfig}
        iosLayout={false}
        menu={pages => ([[
            pages.page,
        ]])}
        pages={pages}
        // reducers={{
        //     homeReducer,
        //     newsFabComponentReducer,
        //     profileWithFriendsReducer,
        //     profileWithFollowingReducer
        // }}
        // locales={{
        //     en: localeEn,
        //     ru: localeRu,
        // }}
        // theme={theme}
        title={"Redequate"}
    />

    return <StyledEngineProvider injectFirst>
        <CssBaseline/>
        {/*<ThemeProvider theme={theme}>*/}
            <SnackbarProvider maxSnack={4} preventDuplicate>
                <BrowserRouter>
                    {children}
                </BrowserRouter>
            </SnackbarProvider>
        {/*</ThemeProvider>*/}
    </StyledEngineProvider>
}

const Page = props => {
    const {children} = props;
    console.log(props);
    return <div>{children}</div>
}
