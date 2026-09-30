import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act, Simulate} from "react-dom/test-utils";
import {GeoCode} from "geo-coder-t";
import PlacesTextField from "../../components/PlacesTextField";

const mockLookup = jest.fn();

jest.mock("geo-coder-t", () => ({
    GeoCode: jest.fn().mockImplementation(() => ({geolookup: mockLookup})),
}), {virtual: true});
jest.mock("@material-ui/icons/Clear", () => () => null, {virtual: true});
jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: value => value}),
}), {virtual: true});

const place = (name, city) => ({
    address: {state: "CA"},
    formatted: name,
    lat: 1,
    lng: 2,
    raw: {address: {locality: city, road: "Main", state: "CA"}},
});

describe("PlacesTextField", () => {
    let container;

    beforeEach(() => {
        jest.useFakeTimers();
        mockLookup.mockReset();
        GeoCode.mockClear();
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
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

    it("passes typed text to onChange and selects a formatted suggestion", async () => {
        mockLookup.mockResolvedValue([place("Oak Street", "Oakland"), place("Oak Street", "Oakland")]);
        const {input, changes} = renderField({type: "formatted", fullWidth: true});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        expect(changes[0]).toEqual({value: "Oak", option: "Oak"});
        expect(mockLookup).not.toHaveBeenCalled();

        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });
        expect(mockLookup).toHaveBeenCalledWith("Oak");
        const options = document.body.querySelectorAll('[role="option"]');
        expect(options).toHaveLength(1);
        act(() => { Simulate.pointerDown(options[0]); });
        act(() => { options[0].click(); });
        expect(changes[1].value).toBe("Oak Street");
        expect(changes[1].option.title).toBe("Oak Street");
        expect(input.value).toBe("Oak Street");
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();

        act(() => { container.querySelector('[title="Clear"]').click(); });
        expect(changes[2].value).toBe("");
        expect(input.value).toBe("");
        expect(document.activeElement).toBe(input);
    });

    it("ignores a stale lookup and supports keyboard selection", async () => {
        let resolveFirst;
        mockLookup
            .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
            .mockResolvedValueOnce([place("Second", "Sacramento")]);
        const {input, changes} = renderField({type: "citystate"});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "First"}}); });
        act(() => { jest.advanceTimersByTime(500); });
        act(() => { Simulate.change(input, {target: {value: "Second"}}); });
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });
        await act(async () => {
            resolveFirst([place("First", "Fresno")]);
            await Promise.resolve();
        });

        expect(GeoCode).toHaveBeenCalledWith("osm", {featuretype: ["city", "state"]});
        expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(1);
        act(() => { Simulate.keyDown(input, {key: "ArrowDown"}); });
        act(() => { Simulate.keyDown(input, {key: "Enter"}); });
        expect(changes[changes.length - 1].value).toBe("Sacramento, CA");
    });

    it("clears suggestions and loading after a failed lookup", async () => {
        mockLookup.mockRejectedValue(new Error("Network unavailable"));
        const {input} = renderField({});
        act(() => { input.focus(); });
        act(() => { Simulate.change(input, {target: {value: "Oak"}}); });
        await act(async () => {
            jest.advanceTimersByTime(500);
            await Promise.resolve();
        });
        expect(document.body.querySelector('[role="listbox"]')).toBeNull();

        act(() => { Simulate.change(input, {target: {value: ""}}); });
        act(() => { jest.advanceTimersByTime(500); });
        expect(mockLookup).toHaveBeenCalledTimes(1);
    });
});
