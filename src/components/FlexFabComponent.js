import React from "react";
import Fab from "@material-ui/core/Fab";
import Zoom from "@material-ui/core/Zoom";
import Tooltip from "@material-ui/core/Tooltip";
import {styles} from "../controllers/Theme";
import {useWindowData} from "../controllers/General";
import useScrollPosition from "../controllers/useScrollPosition";
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

const Wrapper = ({tooltip, children}) => {
    if (tooltip) {
        return <Tooltip title={tooltip}>
            <>{children}</>
        </Tooltip>
    } else {
        return children;
    }
}
