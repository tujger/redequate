import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import {useMetaInfo} from "../../controllers/General";
import PlacesTextField from "../../components/PlacesTextField";
import menuStyles from "../../controls/Menu/Menu.module.css";
import styles from "../../components/styles/PlacesTextField.module.css";

jest.mock("../../controllers/General", () => ({useMetaInfo: jest.fn()}));
jest.mock("@mui/icons-material/Clear", () => () => null, {virtual: true});
jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: value => value}),
}), {virtual: true});

const place = (name, city) => ({
    formatted: name,
    city,
    state: "California",
    state_code: "CA",
    street: "Main",
    lat: 1,
    lon: 2,
    result_type: "city",
});
const response = results => ({ok: true, json: () => Promise.resolve({results})});

describe("PlacesTextField", () => {
    let container;
    let originalFetch;

    beforeEach(() => {
        jest.useFakeTimers();
        originalFetch = window.fetch;
        window.fetch = jest.fn();
        useMetaInfo.mockReturnValue({settings: {geoapifyApiKey: "test-key"}});
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
        window.fetch = originalFetch;
        jest.useRealTimers();
    });

    const renderField = props => {
        const changes = [];
        const Field = () => {
            const [value, setValue] = React.useState("");
            return <PlacesTextField
                {...props}
                onChange={(event, option) => {
                    event.persist();
                    changes.push({value: event.target.value, option});
                    setValue(event.target.value);
                }}
                value={value}
            />;
        };
        act(() => { render(<Field/>, container); });
        return {input: container.querySelector("input"), changes};
    };

    const advanceSearch = async () => {
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            await Promise.resolve();
        });
    };

    it("requests Geoapify and selects a deduplicated formatted suggestion", async () => {
        window.fetch.mockResolvedValue(response([place("Oak Street", "Oakland"), place("Oak Street", "Oakland")]));
        const {input, changes} = renderField({type: "formatted", fullWidth: true});
        expect(input.getAttribute("autocomplete")).toBe("off");
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        expect(changes[0]).toEqual({value: "Oak", option: "Oak"});
        expect(window.fetch).not.toHaveBeenCalled();

        await advanceSearch();
        const url = new URL(window.fetch.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe("https://api.geoapify.com/v1/geocode/autocomplete");
        expect(url.searchParams.get("text")).toBe("Oak");
        expect(url.searchParams.get("apiKey")).toBe("test-key");
        expect(url.searchParams.get("format")).toBe("json");
        expect(url.searchParams.get("limit")).toBe("10");
        expect(url.searchParams.has("type")).toBe(false);
        const options = document.body.querySelectorAll('[role="option"]');
        expect(options).toHaveLength(1);
        expect(document.activeElement).toBe(input);
        expect(options[0].closest(`.${menuStyles.menu}`)).not.toBeNull();
        expect(options[0].classList.contains(menuStyles.menuItem)).toBe(true);
        expect(document.body.querySelector('[role="listbox"]').querySelector("a")).toBeNull();
        expect(document.body.querySelectorAll(`.${styles.attribution} a`)).toHaveLength(2);
        act(() => { Simulate.pointerDown(options[0]); });
        expect(document.activeElement).toBe(input);
        act(() => { options[0].click(); });
        expect(changes[1].value).toBe("Oak Street");
        expect(changes[1].option.title).toBe("Oak Street");
        expect(changes[1].option.data).toMatchObject({lat: 1, lng: 2, citystate: "Oakland, CA", address: {city: "Oakland", state: "CA"}});
        expect(input.value).toBe("Oak Street");
        expect(document.activeElement).toBe(input);
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
        expect(document.body.querySelector(`.${styles.attribution}`)).toBeNull();

        act(() => { container.querySelector('[title="Clear"]').click(); });
        expect(changes[2].value).toBe("");
        expect(input.value).toBe("");
        expect(document.activeElement).toBe(input);
    });

    it("ignores stale responses and selects a city or state from the keyboard", async () => {
        let resolveFirst;
        window.fetch
            .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
            .mockResolvedValueOnce(response([place("Second", "Sacramento"), {...place("District", "Sacramento"), result_type: "district"}]));
        const {input, changes} = renderField({type: "citystate"});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "First"}}); });
        act(() => { jest.advanceTimersByTime(500); });
        act(() => { Simulate.change(input, {target: {value: "Second"}}); });
        await advanceSearch();
        await act(async () => {
            resolveFirst(response([place("First", "Fresno")]));
            await Promise.resolve();
        });

        expect(new URL(window.fetch.mock.calls[1][0]).searchParams.get("type")).toBe("locality");
        expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(1);
        act(() => { Simulate.keyDown(input, {key: "ArrowDown"}); });
        act(() => { Simulate.keyDown(input, {key: "Enter"}); });
        expect(changes[changes.length - 1].value).toBe("Sacramento, CA");
    });

    it("clears suggestions after HTTP failure and does not search empty text", async () => {
        window.fetch.mockResolvedValue({ok: false, status: 403});
        const {input} = renderField({});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        await advanceSearch();
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();

        act(() => { Simulate.change(input, {target: {value: ""}}); });
        act(() => { jest.advanceTimersByTime(500); });
        expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it("closes the menu when Geoapify returns no suggestions", async () => {
        window.fetch.mockResolvedValue(response([]));
        const {input} = renderField({});
        act(() => { Simulate.change(input, {target: {value: "Unknown"}}); });
        await advanceSearch();
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    });

    it("does not request without a configured key", () => {
        useMetaInfo.mockReturnValue({settings: {}});
        const {input, changes} = renderField({});
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        act(() => { jest.advanceTimersByTime(500); });
        expect(changes[0].value).toBe("Oak");
        expect(window.fetch).not.toHaveBeenCalled();
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    });

    it("uses the anchor width and repositions on scroll", async () => {
        window.fetch.mockResolvedValue(response([place("Oak Street", "Oakland")]));
        const {input} = renderField({});
        let left = 100;
        container.firstChild.getBoundingClientRect = () => ({left, right: left + 200, top: 50, bottom: 90, width: 200});
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        const menu = document.body.querySelector(`.${menuStyles.menu}`);
        expect(menu.style.left).toBe("100px");
        expect(menu.style.top).toBe("94px");
        expect(menu.style.width).toBe("200px");
        await advanceSearch();
        left = 140;
        act(() => { document.dispatchEvent(new Event("scroll")); });
        expect(menu.style.left).toBe("140px");
    });

    it("closes and cancels a pending search after an outside pointer", () => {
        const {input} = renderField({});
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
        act(() => { document.body.dispatchEvent(new MouseEvent("pointerdown", {bubbles: true})); });
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
        act(() => { jest.advanceTimersByTime(500); });
        expect(window.fetch).not.toHaveBeenCalled();
    });

    it("keeps old suggestions selectable while a new search begins", async () => {
        window.fetch.mockResolvedValue(response([place("Oak Street", "Oakland")]));
        const {input, changes} = renderField({});
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        await advanceSearch();
        act(() => { Simulate.change(input, {target: {value: "Sac"}}); });
        const oldOption = document.body.querySelector('[role="option"]');
        expect(oldOption.textContent).toBe("Oak Street");
        act(() => { oldOption.click(); });
        expect(changes[changes.length - 1].value).toBe("Oak Street");
        act(() => { jest.advanceTimersByTime(500); });
        expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it("can select an old suggestion with the keyboard during reload", async () => {
        window.fetch.mockResolvedValue(response([place("Oak Street", "Oakland")]));
        const {input, changes} = renderField({});
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        await advanceSearch();
        act(() => { Simulate.change(input, {target: {value: "Sac"}}); });
        act(() => { Simulate.keyDown(input, {key: "ArrowDown"}); });
        act(() => { Simulate.keyDown(input, {key: "Enter"}); });
        expect(changes[changes.length - 1].value).toBe("Oak Street");
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();
    });

    it("replaces old suggestions with loading after one second", async () => {
        let resolveNext;
        window.fetch
            .mockResolvedValueOnce(response([place("Oak Street", "Oakland")]))
            .mockImplementationOnce(() => new Promise(resolve => { resolveNext = resolve; }));
        const {input, changes} = renderField({});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        await advanceSearch();
        act(() => { Simulate.change(input, {target: {value: "Sac"}}); });
        act(() => { jest.advanceTimersByTime(999); });
        expect(document.body.querySelector('[role="option"]').textContent).toBe("Oak Street");
        expect(document.body.querySelector('[role="status"]')).toBeNull();
        act(() => { jest.advanceTimersByTime(1); });
        expect(document.body.querySelector('[role="option"]')).toBeNull();
        expect(document.body.querySelector('[role="status"]').textContent).toBe("Common.Loading...");
        expect(input.getAttribute("aria-activedescendant")).toBeNull();

        await act(async () => {
            resolveNext(response([place("Sacramento", "Sacramento")]));
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(document.body.querySelector('[role="option"]').textContent).toBe("Sacramento");
        act(() => { Simulate.keyDown(input, {key: "ArrowDown"}); });
        act(() => { Simulate.keyDown(input, {key: "Enter"}); });
        expect(changes[changes.length - 1].value).toBe("Sacramento");
    });
});
