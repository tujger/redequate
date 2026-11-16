import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../../render";
import ActionShare from "../../../components/PostComponent/ActionShare";

vi.mock("../../../controllers/General", () => ({usePages: () => ({post: {route: "/post/"}})}));
vi.mock("react-redux", () => ({useDispatch: () => vi.fn()}));
vi.mock("react-i18next", () => ({useTranslation: () => ({t: value => value})}));
vi.mock("../../../components/ProgressView", () => ({default: {SHOW: {}, HIDE: {}}}));
vi.mock("../../../components/ShareComponent", () => ({share: vi.fn().mockResolvedValue(undefined)}));
vi.mock("../../../controllers/notifySnackbar", () => ({default: vi.fn()}));

describe("ActionShare DOM props", () => {
    let container;
    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });
    afterEach(() => {
        unmount(container);
        container.remove();
    });

    it("consumes post service props and forwards ordinary DOM attributes", () => {
        render(<ActionShare onMenuItemClick={() => {}} postData={{id: "post"}}
            userData={{id: "user"}} allowedExtras={["like"]} bordered expanded collapsible
            disableClick handleClickPost={() => {}} onDelete={() => {}}
            aria-label="Share this post" data-source="post-menu"/>, container);
        const item = container.querySelector('[data-value="share"]');
        expect(item.getAttribute("aria-label")).toBe("Share this post");
        expect(item.getAttribute("data-source")).toBe("post-menu");
        for (const name of ["postdata", "userdata", "allowedextras", "bordered", "expanded",
            "collapsible", "disableclick", "handleclickpost", "ondelete"]) {
            expect(item.hasAttribute(name), name).toBe(false);
        }
    });

    it("keeps the upload configuration out of the share menu DOM", () => {
        render(<ActionShare onMenuItemClick={() => {}} postData={{id: "post"}}
            UploadProps={{allowedFileTypes: ["image/*"]}}/>, container);
        expect(container.querySelector('[data-value="share"]').hasAttribute("uploadprops")).toBe(false);
    });
});
