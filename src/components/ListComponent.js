import React from "react";
import ClearIcon from "@mui/icons-material/Clear";
import CheckAllIcon from "@mui/icons-material/DoneAll";
import SortIcon from "@mui/icons-material/Sort";
import PropTypes from "prop-types";
import Button from "../controls/Button/Button";
import ListSwipeableItemComponent from "./ListSwipeableItemComponent";
import ListAction from "./ListAction";
import ModalComponent from "./ModalComponent";
import notifySnackbar from "../controllers/notifySnackbar";
import styles from "./styles/ListComponent.module.css";

const ListComponent = props => {
    let {
        items,
        emptyComponent,
        itemComponent,
        leftAction,
        rightAction
    } = props;

    const [state, setState] = React.useState({/*sortType: "createDate", sortReverse: false, */countSelected: 0});
    const {countSelected, action = false} = state;
    const cancelButtonRef = React.useRef(null);

    React.useEffect(() => {
        if (action) cancelButtonRef.current?.focus();
    }, [action]);

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
        return items.filter(item => item.selected).length;
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
        <div className={styles.toolbar}>
            {countSelected ? <div className={styles.counter}>
                {countSelected} selected
            </div> : null}
            {countSelected ? <Button
                icon={<CheckAllIcon/>}
                onClick={selectAll}
                onContextMenu={hiddenContextMenu}
                title={"Select all"}
            /> : null}
            {countSelected ? <Button
                icon={<ClearIcon/>}
                onClick={unselectAll}
                onContextMenu={hiddenContextMenu}
                title={"Unselect all"}
            /> : null}
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
            {!countSelected ? <Button
                icon={<SortIcon/>}
                onContextMenu={hiddenContextMenu}
                title={"Sort"}
            /> : null}
        </div>
        <div className={styles.list}>
            {items.map((item, index) => <ListSwipeableItemComponent
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
            </ListSwipeableItemComponent>)}
            {!items.length && emptyComponent}
        </div>
        {action && <ModalComponent ariaLabelledBy={"list-action-dialog-title"} onClose={cancelDialog}>
            <div className={styles.dialogTitle} id={"list-action-dialog-title"}>
                {action.askTitle || "Title"}
            </div>
            <div className={styles.dialogContent}>
                {action.ask || "Question"}
            </div>
            <div className={styles.dialogActions}>
                <Button color={"primary"} onClick={cancelDialog} ref={cancelButtonRef} variant={"text"}>
                    Cancel
                </Button>
                <Button onClick={() => actionAllConfirmed(action)}
                        color={action.variant === "warning" ? "secondary" : "primary"} variant={"text"}>
                    Delete
                </Button>
            </div>
        </ModalComponent>}
    </React.Fragment>
};

ListComponent.propTypes = {
    items: PropTypes.array,
    itemComponent: PropTypes.any,
    emptyComponent: PropTypes.any,
    leftAction: PropTypes.objectOf(ListAction),
    rightAction: PropTypes.objectOf(ListAction),
};

export default ListComponent;
