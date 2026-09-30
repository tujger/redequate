import React from "react";
import ProgressView from "../../components/ProgressView";
import styles from "./styles/StickyHeaderComponent.module.css";

export const StickyHeaderComponent = ({content, image, menuComponent, title, titleClassName}) => {
    const [collapsed, setCollapsed] = React.useState(false);
    const refContent = React.useRef(null);
    const refObserver = React.useRef(null);
    const refSticky = React.useRef(null);
    const refTitle = React.useRef(null);

    React.useEffect(() => {
        let frame = null;

        const updateProgress = () => {
            const distance = refContent.current.offsetHeight - refSticky.current.offsetHeight;
            const observerTop = refObserver.current.getBoundingClientRect().top;
            const progress = distance > 0
                ? Math.max(0, Math.min(1, 1 - observerTop / distance))
                : 1;

            refTitle.current.style.setProperty("--title-collapse-progress", progress);
            setCollapsed(progress === 1);
        };

        const scheduleUpdate = () => {
            if (frame !== null) return;
            frame = window.requestAnimationFrame(() => {
                frame = null;
                updateProgress();
            });
        };

        updateProgress();
        document.addEventListener("scroll", scheduleUpdate, {capture: true, passive: true});
        window.addEventListener("resize", scheduleUpdate);

        return () => {
            document.removeEventListener("scroll", scheduleUpdate, true);
            window.removeEventListener("resize", scheduleUpdate);
            if (frame !== null) window.cancelAnimationFrame(frame);
        };
    }, []);

    const imageStyle = image ? {backgroundImage: `url(${image})`} : undefined;

    return <>
        <div ref={refContent} className={styles.content} style={imageStyle}>{content}</div>
        <div ref={refObserver} className={styles.observer}/>
        <div
            ref={refSticky}
            className={[styles.sticky, collapsed && styles.collapsed].filter(Boolean).join(" ")}
            style={collapsed ? imageStyle : undefined}
        >
            <div ref={refTitle} className={[styles.title, titleClassName].filter(Boolean).join(" ")}>{title}</div>
            {menuComponent}
            <ProgressView/>
        </div>
    </>
};
