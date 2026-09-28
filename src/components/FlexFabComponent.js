import React from "react";
import useScrollPosition from "../controllers/useScrollPosition";
import useRippleEffect from "../helpers/useRippleEffect";
import styles from "./styles/FlexFabComponent.module.css";

const FlexFabComponent = ({
    capitalized = false,
    children,
    className,
    color = "primary",
    icon,
    label,
    onClick = evt => {
        console.log("[FlexFab] click", evt)
    },
    onPointerDown: givenOnPointerDown,
    tooltip,
    ...props
}) => {
    const [state, setState] = React.useState({});
    const {expanded = true} = state;
    const onPointerDown = useRippleEffect(givenOnPointerDown);
    const colorClass = color === "primary" ? styles.primary : styles.secondary;

    useScrollPosition(({currPos}) => {
        setState(state => ({...state, expanded: currPos.y >= -200}));
    }, []);

    if (!children && !icon && !label) return null;

    const commonProps = {
        ...props,
        "aria-label": label,
        className: [styles.fab, colorClass, className].filter(Boolean).join(" "),
        onClick,
        onKeyDown: event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onClick(event);
        },
        onPointerDown,
        role: "button",
        tabIndex: 0,
    };

    return <>
        <div
            {...commonProps}
            aria-hidden={!expanded}
            className={[commonProps.className, styles.expanded, expanded ? styles.visible : styles.hidden]
                .join(" ")}
            data-tooltip={tooltip || undefined}
            style={capitalized ? undefined : {textTransform: "none"}}
            tabIndex={expanded ? 0 : -1}
        >
            {children}
            {label}
        </div>
        <div
            {...commonProps}
            aria-hidden={expanded}
            className={[commonProps.className, styles.collapsed, expanded ? styles.hidden : styles.visible]
                .join(" ")}
            data-tooltip={tooltip || undefined}
            tabIndex={expanded ? -1 : 0}
        >
            {icon}
            {children}
        </div>
    </>;
};

export default FlexFabComponent;
