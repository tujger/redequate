import {Fab, Tooltip, Zoom} from "@mui/material";
import {useTheme} from "@mui/styles";
import React from "react";
import {useWindowData} from "../controllers/General";
import useScrollPosition from "../controllers/useScrollPosition";
import styles from "./styles/FlexFabComponent.module.css";

const FlexFabComponent = (
    {
        capitalized = false,
        children,
        className,
        icon,
        label,
        onClick = evt => {
            console.log("[FlexFab] click", evt)
        },
        tooltip,
        ...props
    }) => {
    const theme = useTheme();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {expanded = true} = state;

    const transitionDuration = {
        enter: theme.transitions.duration.enteringScreen,
        exit: theme.transitions.duration.leavingScreen,
    };

    useScrollPosition(({prevPos, currPos}) => {
        if (currPos.y < -200) {
            setState(state => ({...state, expanded: false}));
        } else {
            setState(state => ({...state, expanded: true}));
        }
        // const isShow = currPos.y > prevPos.y
        // if (isShow !== hideOnScroll) setHideOnScroll(isShow)
    }, [])

    if (!children && !icon && !label) return null;
    return <Wrapper tooltip={tooltip}>
        <Zoom
            in={expanded}
            key={"expanded"}
            timeout={transitionDuration}
            unmountOnExit
        >
            <Fab
                aria-label={label}
                className={[styles.fab, styles._common, className, styles._expanded].join(" ")}
                onClick={onClick}
                style={capitalized ? undefined : {textTransform: "none"}}
                variant={"extended"}
            >
                {children}
                {label}
            </Fab>
        </Zoom>
        <Zoom
            in={!expanded}
            key={"collapsed"}
            timeout={transitionDuration}
            unmountOnExit
        >
            <Fab
                aria-label={label}
                className={[styles.fab, styles._common, className, styles._collapsed].join(" ")}
                onClick={onClick}
                variant={"round"}
            >
                {icon}
                {children}
            </Fab>
        </Zoom>
    </Wrapper>
}

export default FlexFabComponent;

const Wrapper = ({tooltip, children}) => {
    if (tooltip) {
        return <Tooltip title={tooltip}>
            <>{children}</>
        </Tooltip>
    } else {
        return children;
    }
}
