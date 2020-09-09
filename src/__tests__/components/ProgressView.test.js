import React from 'react';
import {render} from 'react-dom';
import LinearProgress from "@material-ui/core/LinearProgress";
import ProgressView from '../../components/ProgressView';
import {container, store} from "../common";
import {act} from "react-dom/test-utils";
import ThemeProvider from "@material-ui/styles/ThemeProvider";
import {BrowserRouter} from "react-router-dom";
import {Provider} from "react-redux";
import {default as defaultTheme} from "../../controllers/Theme";

jest.mock('@material-ui/core/LinearProgress', () => (...rest) => {
    return(
        <div>
            <input
                data-testid='mock-component'
            />
        </div>
    )
});
// jest.mock("@material-ui/core/LinearProgress", () => ({
//     LinearProgress: props => console.log(props)
// }));


describe("ProgressView", () => {
    it("indeterminate", () => {
        act(() => {
            render(<Provider store={store}>
                <ThemeProvider theme={defaultTheme}>
                    <BrowserRouter>
                        <ProgressView/>
                    </BrowserRouter>
                </ThemeProvider>
            </Provider>, container);
            store.dispatch(ProgressView.SHOW);
        });
        expect(container.firstChild.getAttribute("role")).toEqual("progressbar");
    });
    it("20%", () => {
        act(() => {
            render(<Provider store={store}>
                <ThemeProvider theme={defaultTheme}>
                    <BrowserRouter>
                        <ProgressView/>
                    </BrowserRouter>
                </ThemeProvider>
            </Provider>, container);
            store.dispatch({...ProgressView.SHOW, value: 20});
        });
        expect(container.firstChild.getAttribute("aria-valuenow")).toEqual("20");
    });
    it("hide", () => {
        act(() => {
            render(<Provider store={store}>
                <ThemeProvider theme={defaultTheme}>
                    <BrowserRouter>
                        <ProgressView/>
                    </BrowserRouter>
                </ThemeProvider>
            </Provider>, container);
            store.dispatch(ProgressView.HIDE);
        });
        console.log(container.firstChild.className)
        expect(container.firstChild.className).toMatch(/ProgressView-invisibleProgress-1/);
    });
})
