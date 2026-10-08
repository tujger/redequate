import {act} from "react";
import {createRoot} from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots = new WeakMap();

export function render(element, container) {
    let root = roots.get(container);
    if (!root) {
        root = createRoot(container);
        roots.set(container, root);
    }
    act(() => root.render(element));
}

export function unmount(container) {
    const root = roots.get(container);
    if (!root) return;
    act(() => root.unmount());
    roots.delete(container);
}
