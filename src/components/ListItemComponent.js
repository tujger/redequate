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
    },
    leftButton: {
        color: "#ff0000",
        left: theme.spacing(1),
        opacity: 0,
        position: "absolute",
    },
    rightButton: {
        color: "#00aa00",
        right: theme.spacing(1),
        opacity: 0,
        position: "absolute",
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
const calculateActionIndent = () => {
    let indent = 300;
    if(isMobile) {
        indent = window.innerWidth / 2;
    } else {
        indent = window.innerWidth/4;
        if(indent > 400) indent  = 400;
    }
    return indent;
};

const defaultLeftButton = <IconButton aria-label="delete">
    <Delete/>
</IconButton>;

const defaultRightButton = <IconButton aria-label="check">
  <Check/>
</IconButton>;

function ListItemComponent(props) {
    const {classes, children, leftButton = defaultLeftButton, rightButton = defaultRightButton} = props;

    const [state, setState] = React.useState({});
    const {x, down, dragging, removed} = state;

    const opacityIndent = calculateOpacityIndent();
    const actionIndent = calculateActionIndent();

    const bind = useDrag(evt => {
        const {down, movement: [mx]} = evt;
        if (Math.abs(mx) < 5) return;
        let x = mx;
        let removed = false;
        try {
            if(!down) {
                if(mx > actionIndent) {
                    removed = children.props.onSwipe("right");
                } else if(mx < -actionIndent) {
                    removed = children.props.onSwipe("left");
                }
                x = 0;
            }
        } catch(e) {
            console.error(e);
            notifySnackbar({title: e.message, variant: "error"});
            x = 0;
        }
        setState({...state, dragging: true, down, x: x, removed})
    });
    const bind_ = bind; //isMobile ? bind : () => {};

    if(removed) return null;
    return <div className={classes.root}>
        <leftButton.type className={classes.leftButton} {...leftButton.props} style={{opacity: (x || 0)/opacityIndent}}/>
        <rightButton.type className={classes.rightButton} {...rightButton.props} style={{opacity: -(x || 0)/opacityIndent}}/>
        <div {...bind_()}
                  onClickCapture={event => {
                      if (dragging) {
                          event.stopPropagation();
                          event.preventDefault();
                          if (!down) {
                              setState({...state, dragging: false});
                          }
                      }
                  }}
             className={classes.content}
                  style={{left: x}}>
          {children}
        </div>
    </div>
}

ListItemComponent.propTypes = {
    children: PropTypes.any,
};

export default withStyles(styles)(ListItemComponent);
