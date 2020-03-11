import React from 'react';
import {IconButton, withStyles} from "@material-ui/core";
import PropTypes from 'prop-types';
import {Check, Delete} from "@material-ui/icons";
import {useDrag} from "react-use-gesture";
import {isMobile} from "react-device-detect";
import {notifySnackbar} from "../controllers";

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

const defaultLeftButton = <IconButton aria-label="delete">
    <Delete/>
</IconButton>;

const defaultRightButton = <IconButton aria-label="check">
    <Check/>
</IconButton>;

function ListItemComponent(props) {
    const {classes, children, leftButton = defaultLeftButton, leftButtonLabel = "Delete", rightButton = defaultRightButton, rightButtonLabel = "Check"} = props;

    const [state, setState] = React.useState({});
    const {x, dragging, removing, ref, removed} = state;


    const opacityIndent = calculateOpacityIndent();
    const actionIndent = calculateActionIndent();

    const bind = useDrag(evt => {
        if(!children.props || !children.props.onSwipe) return;
        const {down, movement: [mx]} = evt;
        if (down && Math.abs(mx) < 10) return;
        let x = mx;
        let removing = false;
        try {
            if(!down) {
                if(mx > actionIndent) {
                    removing = children.props.onSwipe("right", children);
                } else if(mx < -actionIndent) {
                    removing = children.props.onSwipe("left", children);
                }
                x = 0;
            }
        } catch(e) {
            console.error(e);
            notifySnackbar({title: e.message, variant: "error"});
            x = 0;
        }
        setState({...state, dragging: down, x: x, removing})
    });
    const bind_ = (process.env.NODE_ENV === 'development') ? bind : (isMobile ? bind : () => {});

    React.useEffect(() => {
        const ref = React.createRef();
        setState({...state, ref})
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
    return <div className={classes.root} ref={ref}>
        <div className={classes.leftAction}>
            <leftButton.type
                className={[classes.leftActionButton, x > actionIndent ? classes.leftActionButtonSelected : ""].join(" ")}
                {...leftButton.props}
                style={{opacity: (x || 0)/opacityIndent}}
            />
            <span
                className={classes.leftActionLabel}
                style={{opacity: x > opacityIndent ? 1 : 0}}
                children={leftButtonLabel} />
        </div>
        <div className={classes.rightAction}>
            <rightButton.type
                className={[classes.rightActionButton, x < -actionIndent ? classes.rightActionButtonSelected : ""].join(" ")}
                {...rightButton.props}
                style={{opacity: -(x || 0)/opacityIndent}}
            />
            <span
                className={classes.rightActionLabel}
                style={{opacity: x < -opacityIndent ? 1 : 0}}
                children={rightButtonLabel} />
        </div>
        <div
            {...bind_()}
            onClickCapture={event => {
                if (dragging) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (x === 0) {
                        setState({...state, dragging: false, x: 0});
                    }
                }
            }}
            className={classes.content}
            style={{left: x}}
        >
          {children}
        </div>
    </div>
}

ListItemComponent.propTypes = {
    children: PropTypes.any,
    leftButton: PropTypes.element,
    leftButtonLabel: PropTypes.string,
    rightButton: PropTypes.element,
    rightButtonLabel: PropTypes.string,
};

export default withStyles(styles)(ListItemComponent);
