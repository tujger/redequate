import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import PostMenu from "../../components/PostComponent/PostMenu";

jest.mock("@material-ui/icons/MoreVert", () => () => null, {virtual: true});
jest.mock("@material-ui/icons/ArrowDropDown", () => () => null, {virtual: true});
jest.mock("@material-ui/icons/ArrowDropUp", () => () => null, {virtual: true});
jest.mock("../../controllers/UserData", () => ({
    Role: {ADMIN: "admin"},
    matchRole: () => false,
    useCurrentUserData: () => ({id: "user", disabled: false}),
}));
jest.mock("../../controllers/General", () => ({
    useMetaInfo: () => ({settings: {postsAllowEdit: true}}),
}));
jest.mock("react-i18next", () => ({
    useTranslation: () => ({t: value => value}),
}), {virtual: true});
jest.mock("../../components/PostComponent/ActionShare", () => () => null);
jest.mock("../../components/PostComponent/ActionEdit", () => props => {
    const React = require("react");
    return React.createElement("div", {"data-action": "edit", "data-request": props.openRequest});
});
jest.mock("../../components/PostComponent/ActionDelete", () => props => {
    const React = require("react");
    return React.createElement("div", {"data-action": "delete", "data-open": String(props.open)});
});

describe("PostMenu", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => {
            render(<PostMenu postData={{id: "post", uid: "user"}}/>, container);
        });
    });

    afterEach(() => {
        unmountComponentAtNode(container);
        container.remove();
    });

    it("keeps the edit action outside the menu after selection", () => {
        act(() => {
            container.querySelector('[role="button"]').click();
        });
        act(() => {
            document.querySelector('[data-value="edit"]').click();
        });

        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(container.querySelector('[data-action="edit"]').getAttribute("data-request")).toBe("1");
    });

    it("keeps delete confirmation outside the menu after selection", () => {
        act(() => {
            container.querySelector('[role="button"]').click();
        });
        act(() => {
            document.querySelector('[data-value="delete"]').click();
        });

        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(container.querySelector('[data-action="delete"]').getAttribute("data-open")).toBe("true");
    });
});
