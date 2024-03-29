import React from "react";

const isBrowser = typeof window !== "undefined";

export function getScrollPosition({element, useWindow}) {
    if (!isBrowser) return {x: 0, y: 0}

    const target = element ? element.current : document.body
    const position = target.getBoundingClientRect()

    return useWindow
        ? {x: window.scrollX, y: window.scrollY}
        : {x: position.left, y: position.top}
}

export default (effect, deps, element, useWindow, wait) => {
    const position = React.useRef(getScrollPosition({useWindow}))
    React.useLayoutEffect(() => {
        let throttleTimeout = null
        const callBack = () => {
            const currPos = getScrollPosition({element, useWindow})
            effect({prevPos: position.current, currPos})
            position.current = currPos
            throttleTimeout = null
        }
        const handleScroll = () => {
            if (wait) {
                if (throttleTimeout === null) {
                    throttleTimeout = setTimeout(callBack, wait)
                }
            } else {
                callBack()
            }
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, deps)
}
