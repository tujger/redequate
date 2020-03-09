import React from 'react';
import {IconButton, ListItem, withStyles} from "@material-ui/core";
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
    leftButton: {
        color: "#ff0000",
        left: theme.spacing(1),
        opacity: 0,
        position: "absolute",
    },
    leftButtonSelected: {
        backgroundColor: "#ff0000",
        color: theme.palette.getContrastText("#ff0000"),
    },
    rightButton: {
        color: "#00aa00",
        right: theme.spacing(1),
        opacity: 0,
        position: "absolute",
    },
    rightButtonSelected: {
        backgroundColor: "#00aa00",
        color: theme.palette.getContrastText("#00aa00"),
    },
    content: {
        position: "relative",
        width: "100%"
    }
});

const calculateOpacityIndent = () => {
    let indent = 300;
    if(isMobile) {
        indent = window.innerWidth / 3;
    } else {
        indent = window.innerWidth/5;
        if(indent > 300) indent  = 300;
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
    const {classes, children, leftButton = defaultLeftButton, rightButton = defaultRightButton} = props;

    const [state, setState] = React.useState({});
    const {x, down, dragging, removing, ref, removed} = state;


    const opacityIndent = calculateOpacityIndent();
    const actionIndent = calculateActionIndent();

    const bind = useDrag(evt => {
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
        setState({...state, dragging: down, down, x: x, removing})
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
                ref.current.style.height = 0;
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
        <leftButton.type
            className={[classes.leftButton, x > actionIndent ? classes.leftButtonSelected : ""].join(" ")}
            {...leftButton.props}
            style={{opacity: (x || 0)/opacityIndent}}
        />
        <rightButton.type
            className={[classes.rightButton, x < -actionIndent ? classes.rightButtonSelected : ""].join(" ")}
            {...rightButton.props}
            style={{opacity: -(x || 0)/opacityIndent}}
        />
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
};

export default withStyles(styles)(ListItemComponent);
