import React from "react";

export default ({css, href}) => {

    React.useEffect(() => {
        if (!css && !href) return;
        const node = document.createElement(href ? "link" : "style");

        if (href) {
            node.rel = "stylesheet";
            node.href = href;
        } else {
            node.textContent = css;
        }
        console.log("[ThemeAbstract]", "mount", {node, href, css});
        document.head.appendChild(node);
        return () => {
            console.log("[ThemeAbstract]", "unmount", {node, href, css});
            node.remove();
        };
    }, [css, href]);
    return null;
};
