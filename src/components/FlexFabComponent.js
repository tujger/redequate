import React from "react";
import Fab from "@material-ui/core/Fab";
import Zoom from "@material-ui/core/Zoom";
import Tooltip from "@material-ui/core/Tooltip";
import {styles, useWindowData} from "../controllers";
import withStyles from "@material-ui/styles/withStyles";
import useTheme from "@material-ui/core/styles/useTheme";

const stylesCurrent = theme => ({
    _common: {
        position: "fixed",
        right: theme.spacing(2),
        transitionDelay: theme.transitions.duration.leavingScreen,//`${expanded ? transitionDuration.exit : 0}ms`,
        // transitionDelay: "0.5s",//theme.transitions.duration.leavingScreen,
        // height: theme.spacing(7),
        // width: theme.spacing(7),
    },
    _collapsed: {},
    _expanded: {
        // width: "auto",
    },
});

const FlexFabComponent = (
    {
        capitalized = false,
        children,
        classes,
        className,
        color = "secondary",
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
                color={color}
                className={[classes.fab, classes._common, className, classes._expanded].join(" ")}
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
                color={color}
                className={[classes.fab, classes._common, className, classes._collapsed].join(" ")}
                onClick={onClick}
                variant={"round"}
            >
                {icon}
                {children}
            </Fab>
        </Zoom>
    </Wrapper>
}

export default withStyles(theme => ({
    ...styles(theme),
    ...stylesCurrent(theme)
}))(FlexFabComponent);

const isBrowser = typeof window !== "undefined";

function getScrollPosition({element, useWindow}) {
    if (!isBrowser) return {x: 0, y: 0}

    const target = element ? element.current : document.body
    const position = target.getBoundingClientRect()

    return useWindow
        ? {x: window.scrollX, y: window.scrollY}
        : {x: position.left, y: position.top}
}

function useScrollPosition(effect, deps, element, useWindow, wait) {
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

const Wrapper = ({tooltip, children}) => {
    if (tooltip) {
        return <Tooltip title={tooltip}>
            <>{children}</>
        </Tooltip>
    } else {
        return children;
    }
}
