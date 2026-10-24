import React from "react";
import {vi} from "vitest";
import {render, unmount} from "../render";
import useChatScroll from "../../chat/useChatScroll";

let root, scroller, container, resized, mutated, observer, mutations;
function Chat() {
    const ref = React.useRef();
    useChatScroll(ref, "one");
    return <div ref={ref}><article>message</article></div>;
}
beforeEach(() => {
    mutations = {observe: vi.fn(), disconnect: vi.fn()};
    vi.stubGlobal("MutationObserver", class {
        constructor(callback) { mutated = callback; return mutations; }
    });
    observer = {observe: vi.fn(), disconnect: vi.fn()};
    vi.stubGlobal("ResizeObserver", class {
        constructor(callback) { resized = callback; return observer; }
    });
    root = document.createElement("div");
    document.body.appendChild(root);
    render(<div style={{overflowY: "auto"}}><Chat/></div>, root);
    scroller = root.firstElementChild;
    container = scroller.firstElementChild;
    Object.defineProperties(scroller, {
        scrollHeight: {configurable: true, value: 1000},
        clientHeight: {value: 400},
    });
    scroller.getBoundingClientRect = () => ({top: 0});
});
afterEach(() => { unmount(root); root.remove(); vi.unstubAllGlobals(); });

it("follows the bottom on initial layout and when messages grow", () => {
    resized();
    expect(scroller.scrollTop).toBe(1000);
    scroller.scrollTop = 600;
    scroller.dispatchEvent(new Event("scroll"));
    Object.defineProperty(scroller, "scrollHeight", {value: 1100});
    resized();
    expect(scroller.scrollTop).toBe(1100);
});

it("preserves the visible message when history or new messages change its offset", () => {
    let top = 20;
    container.firstElementChild.getBoundingClientRect = () => ({top, bottom: top + 60});
    scroller.scrollTop = 250;
    scroller.dispatchEvent(new Event("scroll"));
    top += 120;
    resized();
    expect(scroller.scrollTop).toBe(370);
    top -= 40;
    resized();
    expect(scroller.scrollTop).toBe(330);
    unmount(root);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(mutations.disconnect).toHaveBeenCalledOnce();
});

it("resumes following after the user returns to the bottom", () => {
    scroller.scrollTop = 200;
    scroller.dispatchEvent(new Event("scroll"));
    resized();
    expect(scroller.scrollTop).toBe(200);
    scroller.scrollTop = 599;
    scroller.dispatchEvent(new Event("scroll"));
    resized();
    expect(scroller.scrollTop).toBe(1000);
});

it("compensates inserted history before the resize observer and does not compensate twice", () => {
    let top = 20;
    container.firstElementChild.getBoundingClientRect = () => ({top, bottom: top + 60});
    scroller.scrollTop = 250;
    scroller.dispatchEvent(new Event("scroll"));
    top += 120;
    mutated();
    expect(scroller.scrollTop).toBe(370);
    resized();
    expect(scroller.scrollTop).toBe(370);
});

it("uses a remaining visible message if the first anchor is replaced", () => {
    const first = container.firstElementChild;
    const second = document.createElement("article");
    container.appendChild(second);
    first.getBoundingClientRect = () => ({top: 20, bottom: 80});
    let top = 100;
    second.getBoundingClientRect = () => ({top, bottom: top + 60});
    scroller.scrollTop = 250;
    scroller.dispatchEvent(new Event("scroll"));
    first.remove();
    top += 120;
    mutated();
    expect(scroller.scrollTop).toBe(370);
});
