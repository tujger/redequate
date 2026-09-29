import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import React from "react";
import Button from "../Button/Button";
import styles from "./Tabs.module.css";

export default ({className, items = [], onChange, value}) => {
    const tabsRef = React.useRef(null);
    const selectedIndex = items.findIndex(item => item.value === value);
    const [scrollState, setScrollState] = React.useState({
        canScrollNext: false,
        canScrollPrevious: false,
        overflow: false,
    });

    const updateScrollState = () => {
        const tabs = tabsRef.current;
        if (!tabs) return;

        const maxScrollLeft = tabs.scrollWidth - tabs.clientWidth;
        const nextScrollState = {
            canScrollNext: maxScrollLeft - tabs.scrollLeft > 1,
            canScrollPrevious: tabs.scrollLeft > 1,
            overflow: maxScrollLeft > 1,
        };

        setScrollState(current => Object.keys(nextScrollState)
            .every(key => current[key] === nextScrollState[key]) ? current : nextScrollState);
    };

    React.useLayoutEffect(() => {
        const tabs = tabsRef.current;
        if (!tabs) return undefined;

        updateScrollState();
        tabs.addEventListener("scroll", updateScrollState, {passive: true});

        let resizeObserver;
        if (typeof window !== "undefined" && window.ResizeObserver) {
            resizeObserver = new window.ResizeObserver(updateScrollState);
            resizeObserver.observe(tabs);
            Array.from(tabs.children).forEach(item => resizeObserver.observe(item));
        } else if (typeof window !== "undefined") {
            window.addEventListener("resize", updateScrollState);
        }

        return () => {
            tabs.removeEventListener("scroll", updateScrollState);
            resizeObserver && resizeObserver.disconnect();
            typeof window !== "undefined" && window.removeEventListener("resize", updateScrollState);
        };
    }, [items]);

    const handleKeyDown = (event, index) => {
        let nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = items.length - 1;
        else return;

        event.preventDefault();
        const nextTab = tabsRef.current.querySelectorAll("[role=\"tab\"]")[nextIndex];
        nextTab.focus();
        onChange && onChange(items[nextIndex].value);
    };

    const scrollByPage = direction => {
        const tabs = tabsRef.current;
        tabs && tabs.scrollBy({left: direction * tabs.clientWidth, behavior: "smooth"});
    };

    return <div className={[styles.container, className].filter(Boolean).join(" ")}>
        {scrollState.overflow && <Button
            aria-label={"Scroll tabs left"}
            className={styles.arrowButton}
            disabled={!scrollState.canScrollPrevious}
            onClick={() => scrollByPage(-1)}
            title={"Scroll tabs left"}
            variant={"text"}
        >
            <ChevronLeftIcon/>
        </Button>}
        <div
            aria-label={"Tabs"}
            className={[styles.tabs, !scrollState.overflow && styles.tabsCentered].filter(Boolean).join(" ")}
            ref={tabsRef}
            role={"tablist"}
        >
            {items.map((item, index) => <Button
                aria-selected={index === selectedIndex}
                className={[styles.tab, index === selectedIndex && styles.tabSelected].filter(Boolean).join(" ")}
                color={index === selectedIndex ? "primary" : "secondary"}
                onClick={() => onChange && onChange(item.value)}
                onKeyDown={event => handleKeyDown(event, index)}
                role={"tab"}
                size={"small"}
                tabIndex={index === selectedIndex ? 0 : -1}
                title={item.label}
                variant={"text"}
            >
                {item.icon
                    ? <>
                        <span className={styles.label}>{item.label}</span>
                        <span className={styles.icon}>{item.icon}</span>
                    </>
                    : item.label}
            </Button>)}
        </div>
        {scrollState.overflow && <Button
            aria-label={"Scroll tabs right"}
            className={styles.arrowButton}
            disabled={!scrollState.canScrollNext}
            onClick={() => scrollByPage(1)}
            title={"Scroll tabs right"}
            variant={"text"}
        >
            <ChevronRightIcon/>
        </Button>}
    </div>;
};
