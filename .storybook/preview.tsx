import {CssBaseline, StyledEngineProvider} from "@mui/material";
import {SnackbarProvider} from "notistack";
import React from "react";
import {connect, Provider} from "react-redux";
import {BrowserRouter} from "react-router-dom";
import "../src/styles.css";
import {store} from "./store";

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


const Deco = ({children}) => {
    // const theme = createTheme({colors: colors()});
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
