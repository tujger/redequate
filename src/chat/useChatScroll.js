import React from "react";

export default function useChatScroll(containerRef, chatKey) {
    React.useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        let scroller = container.parentElement;
        while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
            scroller = scroller.parentElement;
        }
        scroller = scroller || document.scrollingElement || document.documentElement;
        let pinned = true;
        let anchors = [];
        const remember = () => {
            const edge = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
            const bottom = edge + scroller.clientHeight;
            anchors = [...container.children].map(node => {
                const {top, bottom} = node.getBoundingClientRect();
                return {node, top, bottom};
            }).filter(rect => rect.bottom > edge && rect.top < bottom);
        };
        const onScroll = event => {
            if (event.target !== scroller && !(event.target === document &&
                scroller === (document.scrollingElement || document.documentElement))) return;
            pinned = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 2;
            remember();
        };
        const restore = () => {
            const anchor = anchors.find(({node}) => node.isConnected);
            if (pinned) {
                scroller.scrollTop = scroller.scrollHeight;
            } else if (anchor) {
                scroller.scrollTop += anchor.node.getBoundingClientRect().top - anchor.top;
            }
            remember();
        };
        const mutations = new MutationObserver(restore);
        const observer = new ResizeObserver(restore);
        mutations.observe(container, {childList: true});
        observer.observe(container);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            mutations.disconnect();
            observer.disconnect();
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [containerRef, chatKey]);
}
