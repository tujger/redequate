import React from "react";
import List from "@material-ui/core/List";
import Toolbar from "@material-ui/core/Toolbar";
import IconButton from "@material-ui/core/IconButton";
import withStyles from "@material-ui/styles/withStyles";
import Grid from "@material-ui/core/Grid";
import Tooltip from "@material-ui/core/Tooltip";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContentText from "@material-ui/core/DialogContentText";
import Button from "@material-ui/core/Button";
import {
    DoneAll as CheckAllIcon,
    Clear as ClearIcon,
    Sort as SortIcon,
} from "@material-ui/icons";
import PropTypes from "prop-types";
import ListItemComponent from "./ListItemComponent";
import ListAction from "./ListAction";
import {notifySnackbar} from "../controllers/Notifications";

const styles = theme => ({
    counter: {
        alignItems: "center",
        display: "flex",
        flex: "auto",
    },
    list: {
        paddingTop: 0,
    },
    toolbar: {
        backgroundColor: theme.palette.background.default,
        justifyContent: "flex-end",
        marginLeft: -theme.spacing(1),
        marginRight: -theme.spacing(1),
        opacity: 0.9,
        position: "sticky",
        top: 0,
        zIndex: 1,
    }
});

const ListComponent = props => {
    let {
        classes,
        items,
        emptyComponent,
        itemComponent,
        leftAction,
        rightAction
    } = props;

    const [state, setState] = React.useState({/*sortType: "createDate", sortReverse: false, */countSelected: 0});
    const {countSelected, action = false} = state;

    items = items.sort((first, second) => {
        if (["fromDate", "toDate", "createDate"].indexOf(state.sortType) >= 0) {
            const left = first[state.sortType];
            const right = second[state.sortType];
            return (left > right ? -1 : left < right ? 1 : 0) * (state.sortReverse ? -1 : 1);
        } else {
            const left = first[state.sortType] || "";
            const right = second[state.sortType] || "";
            return left.toLowerCase().localeCompare(right.toLowerCase()) * (state.sortReverse ? -1 : 1);
        }
    });

    const hiddenContextMenu = evt => {
        evt.stopPropagation();
        evt.preventDefault();
    };

    const selectItem = (evt, item) => {
        item.selected = !item.selected;
        setState({...state, countSelected: countSelected + (item.selected ? 1 : -1)});
        evt.stopPropagation();
        evt.preventDefault();
    };

    const unselectAll = () => {
        items = items.map(item => {
            item.selected = false;
            return item;
        });
        setState({...state, action: false, countSelected: 0});
    };

    const recalculateSelected = () => {
        const count = items.filter(item => item.selected).length;
        return count;
    };

    const selectAll = () => {
        items = items.map(item => {
            item.selected = true;
            return item;
        });
        setState({...state, countSelected: items.length});
    };

    const actionAll = action => {
        if (action.ask) {
            setState({...state, action: action});
        } else {
            actionAllConfirmed(action);
        }
    };

    const cancelDialog = () => {
        setState({...state, action: false});
    };

    const actionAllConfirmed = (action) => {
        action.action(items.filter(item => item.selected));
        unselectAll();
    };

    for (let act of [leftAction, rightAction]) {
        if (act && !act._updated) {
            const action = act.action;
            act.action = arg => {
                try {
                    action(arg);
                } catch (e) {
                    console.error(e);
                    notifySnackbar({title: e.message, variant: "error"});
                }
                setState({...state, action: false, countSelected: recalculateSelected()});
            }
            act._updated = true;
        }
    }

    return <React.Fragment>
        <Toolbar className={classes.toolbar}>
            {countSelected ? <Grid item className={classes.counter}>
                {countSelected} selected
            </Grid> : null}
            {countSelected ? <Tooltip title={"Select all"}>
                <IconButton size={"medium"} onClick={selectAll} onContextMenu={hiddenContextMenu}>
                    <CheckAllIcon/>
                </IconButton>
            </Tooltip> : null}
            {countSelected ? <Tooltip title={"Unselect all"}>
                <IconButton size={"medium"} onClick={unselectAll} onContextMenu={hiddenContextMenu}>
                    <ClearIcon/>
                </IconButton>
            </Tooltip> : null}
            {countSelected && leftAction ? <leftAction.toolbarButton.type
                {...leftAction.toolbarButton.props}
                onClick={() => actionAll(leftAction)}
                onContextMenu={hiddenContextMenu}
            /> : null}
            {countSelected && rightAction ? <rightAction.toolbarButton.type
                {...rightAction.toolbarButton.props}
                onClick={() => actionAll(rightAction)}
                onContextMenu={hiddenContextMenu}
            /> : null}
            {!countSelected ? <Tooltip title={"Sort"}>
                <IconButton size={"medium"} onContextMenu={hiddenContextMenu}>
                    <SortIcon/>
                </IconButton>
            </Tooltip> : null}
        </Toolbar>
        <List className={classes.list}>
            {items.map((item, index) => <ListItemComponent
                key={index + JSON.stringify(item)}
                onContextMenu={evt => selectItem(evt, item)}
                onClickCapture={countSelected ? (evt => selectItem(evt, item)) : null}
                leftAction={leftAction}
                rightAction={rightAction}
            >
                <itemComponent.type
                    {...itemComponent.props}
                    data={item}
                />
            </ListItemComponent>)}
            {!items.length && emptyComponent}
        </List>
        <Dialog
            open={!!action}
            onClose={cancelDialog}
            aria-labelledby="draggable-dialog-title"
        >
            <DialogTitle style={{cursor: "move"}} id="draggable-dialog-title">
                {action.askTitle || "Title"}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {action.ask || "Question"}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button autoFocus onClick={cancelDialog} color="primary">
                    Cancel
                </Button>
                <Button onClick={() => actionAllConfirmed(action)}
                        color={action.variant === "warning" ? "secondary" : "primary"}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    </React.Fragment>
};

ListComponent.propTypes = {
    items: PropTypes.array,
    itemComponent: PropTypes.any,
    emptyComponent: PropTypes.any,
    leftAction: PropTypes.objectOf(ListAction),
    rightAction: PropTypes.objectOf(ListAction),
};

export default withStyles(styles)(ListComponent);
