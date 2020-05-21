import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import PropTypes from "prop-types";
import {useDrag} from "react-use-gesture";
import {isMobile} from "react-device-detect";
import {notifySnackbar} from "../controllers/Notifications";

const styles = theme => ({
    root: {
        alignItems: "center",
        display: "flex",
        position: "relative",
        transition: "height .2s",
    },
    leftAction: {
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        left: theme.spacing(1),
        position: "absolute"
    },
    leftActionButton: {
        color: "#ff0000",
    },
    leftActionButtonSelected: {
        backgroundColor: "#ff0000",
        color: theme.palette.getContrastText("#ff0000"),
    },
    leftActionLabel: {
        color: "#ff0000",
    },
    rightAction: {
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        right: theme.spacing(1),
        position: "absolute"
    },
    rightActionButton: {
        color: "#00aa00",
    },
    rightActionButtonSelected: {
        backgroundColor: "#00aa00",
        color: theme.palette.getContrastText("#00aa00"),
    },
    rightActionLabel: {
        color: "#00aa00",
    },
    content: {
        position: "relative",
        width: "100%"
    }
});

const calculateOpacityIndent = () => {
    let indent = 100;
    if(isMobile) {
        indent = window.innerWidth / 3;
    } else {
        indent = window.innerWidth/5;
        if(indent > 100) indent  = 100;
    }
    return indent;
};
const calculateActionIndent = calculateOpacityIndent;

function ListItemComponent(props) {
    const {classes, children, leftAction, rightAction, onClickCapture, onContextMenu} = props;

    const [state, setState] = React.useState({});
    const {x, dragging, removing, ref, removed, random} = state;

    const opacityIndent = calculateOpacityIndent();
    const actionIndent = calculateActionIndent();

    const bind = useDrag(evt => {
        const {down, movement: [mx]} = evt;
        if (down && Math.abs(mx) < 10) return;
        let x = mx;
        let removing = false;
        try {
            if(!down) {
                if(leftAction && mx > actionIndent) {
                    removing = leftAction.action([children.props.data]);
                } else if(rightAction && mx < -actionIndent) {
                    removing = rightAction.action([children.props.data]);
                }
                x = 0;
            } else {
                if(mx > 0 && !leftAction) x = 0;
                else if(mx < 0 && !rightAction) x = 0;
            }
        } catch(e) {
            console.error(e);
            notifySnackbar({title: e.message, variant: "error"});
            x = 0;
        }
        if(ref && ref.current) {
            setState({...state, dragging: down, x: x, removing})
        }
    });
    const bind_ = (process.env.NODE_ENV === "development") ? bind : (isMobile ? bind : () => {});

    React.useEffect(() => {
        const ref = React.createRef();
        setState({...state, ref});
    }, []);

    if(removing) {
        let sizes = ref.current.getBoundingClientRect();
        ref.current.style.height = sizes.height + "px";
        ref.current.style.overflowY = "hidden";
        setTimeout(() => {
            try {
                ref.current.style.height = "0";
                setTimeout(() => {
                    setState({...state, removing: false, removed: true});
                }, 200);
            } catch(e) {
                console.error(e);
            }
        }, 50);
    }

    if(removed) return null;
    return <div className={classes.root} ref={ref} key={random}>
        {leftAction && leftAction.itemButton({selected: x > actionIndent, style:{right:"auto", opacity:(x || 0)/opacityIndent}})}
        {rightAction && rightAction.itemButton({selected: x < -actionIndent, style:{left:"auto", opacity:-(x || 0)/opacityIndent}})}
        <div
            {...bind_()}
            onContextMenu={onContextMenu ? (evt => {
                onContextMenu(evt);
                setState({...state, random: Math.random()})
            }) : null}
            onClickCapture={onClickCapture || (event => {
                if (dragging) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (x === 0) {
                        setState({...state, dragging: false, x: 0});
                    }
                }
            })}
            className={classes.content}
            style={{left: x, touchAction: "pan-y"}}
        >
          {children}
        </div>
    </div>
}

ListItemComponent.propTypes = {
    children: PropTypes.any,
    leftButton: PropTypes.func,
    leftButtonLabel: PropTypes.string,
    onClickCapture: PropTypes.func,
    onContextMenu: PropTypes.func,
    rightButton: PropTypes.element,
    rightButtonLabel: PropTypes.string,
};

export default withStyles(styles)(ListItemComponent);
