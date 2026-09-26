import {useCallback} from "react";
import baseStyles from "../themes/Base.module.css";

export default (callback = undefined) => {
    return useCallback((event) => {
        const node = event.currentTarget;
        const rect = node.getBoundingClientRect();

        node.style.setProperty(
            "--ripple-x",
            `${event.clientX - rect.left}px`
        );
        node.style.setProperty(
            "--ripple-y",
            `${event.clientY - rect.top}px`
        );
        node.classList.add(baseStyles.ripple);
        callback?.(event);
    }, [callback]);
}
