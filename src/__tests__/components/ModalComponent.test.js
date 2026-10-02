import React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";
import ModalComponent from "../../components/ModalComponent";
import styles from "../../components/styles/ModalComponent.module.css";

jest.mock("react-router-dom", () => ({useHistory: () => ({block: () => () => {}})}), {virtual: true});

describe("ModalComponent", () => {
    let container;
    let widthDescriptor;
    let heightDescriptor;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        widthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
        heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            get() { return this.getAttribute("role") === "dialog" ? 200 : 0; },
        });
        Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
            configurable: true,
            get() { return this.getAttribute("role") === "dialog" ? 160 : 0; },
        });
    });

    afterEach(() => {
        act(() => { unmountComponentAtNode(container); });
        container.remove();
        if (widthDescriptor) Object.defineProperty(HTMLElement.prototype, "offsetWidth", widthDescriptor);
        else delete HTMLElement.prototype.offsetWidth;
        if (heightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", heightDescriptor);
        else delete HTMLElement.prototype.scrollHeight;
    });

    it("positions an anchored dialog below its field and flips it above near the viewport edge", () => {
        const anchor = document.createElement("div");
        anchor.getBoundingClientRect = () => ({left: 100, right: 200, top: 100, bottom: 140, width: 100, height: 40});
        act(() => { render(<ModalComponent anchorEl={anchor}>Calendar</ModalComponent>, container); });

        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog.parentElement.classList.contains(styles.anchored)).toBe(true);
        expect(dialog.style.left).toBe("50px");
        expect(dialog.style.top).toBe("140px");
        expect(document.activeElement).toBe(dialog);

        anchor.getBoundingClientRect = () => ({left: window.innerWidth - 40, right: window.innerWidth + 10,
            top: window.innerHeight - 68, bottom: window.innerHeight - 28, width: 50, height: 40});
        act(() => { window.dispatchEvent(new Event("resize")); });
        expect(dialog.style.top).toBe(`${window.innerHeight - 68 - 160}px`);
        expect(dialog.style.left).toBe(`${window.innerWidth - 208}px`);
    });

    it("keeps unanchored dialogs centered", () => {
        act(() => { render(<ModalComponent>Content</ModalComponent>, container); });
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog.parentElement.classList.contains(styles.anchored)).toBe(false);
        expect(dialog.style.left).toBe("");
        expect(dialog.style.top).toBe("");
    });
});
