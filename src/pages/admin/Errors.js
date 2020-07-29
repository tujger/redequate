import React from "react";
import {connect, useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import IconButton from "@material-ui/core/IconButton";
import Grid from "@material-ui/core/Grid";
import Input from "@material-ui/core/Input";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import MenuItem from "@material-ui/core/MenuItem";
import Toolbar from "@material-ui/core/Toolbar";
import LazyListComponent from "../../components/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import {cacheDatas, useFirebase} from "../../controllers/General";
import ProgressView from "../../components/ProgressView";
import ErrorItemComponent from "../../components/ErrorItemComponent";
import ConfirmComponent from "../../components/ConfirmComponent";
import {notifySnackbar} from "../../controllers";
import AvatarView from "../../components/AvatarView";

const Errors = (props) => {
    const {mode = "all", filter} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {deleteOpen} = state;

    const handleMode = evt => {
        dispatch({type: LazyListComponent.RESET});
        dispatch({type: Errors.MODE, mode: evt.target.value, filter});
    }

    const handleFilter = evt => {
        dispatch({type: LazyListComponent.RESET});
        dispatch({type: Errors.MODE, filter: evt.target.value});
    }

    const handleConfirmDeletion = evt => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("errors").set(null)
            .then(() => dispatch({type: LazyListComponent.RESET}))
            .then(() => setState({...state, deleteOpen: false}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    React.useEffect(() => {
        return () => {
            dispatch(ProgressView.HIDE);
        }
// eslint-disable-next-line
    }, [mode]);

    let pagination;
    let itemTransform;
    switch (mode) {
        case "all":
            pagination = new Pagination({
                child: filter ? "uid" : undefined,
                equals: filter ? filter : undefined,
                order: "desc",
                ref: firebase.database().ref("errors"),
                size: 20
            })
            itemTransform = item => item;
            break;
        default:
    }

    const filteredUserData = filter ? cacheDatas.get(filter) : null;

    return <React.Fragment>
        <Toolbar disableGutters>
            <Select
                color={"secondary"}
                onChange={handleMode}
                value={mode}
            >
                <MenuItem value={"all"}>All errors</MenuItem>
            </Select>
            <Grid item xs>
                {mode === "all" && filteredUserData && <Chip
                    avatar={<AvatarView alt="" image={filteredUserData.image} initials={filteredUserData.name}
                                        verified={true}/>}
                    label={filteredUserData.name}
                    onDelete={() => {
                        dispatch({type: Errors.MODE, mode, filter: ""});
                        dispatch({type: LazyListComponent.RESET});
                    }}
                />}
            </Grid>
            <IconButton onClick={() => setState({...state, deleteOpen: true})}>
                <ClearIcon/>
            </IconButton>
        </Toolbar>
        <LazyListComponent
            itemComponent={item => <ErrorItemComponent
                data={item}
                key={item.key}
                onUserClick={(event, filter) => {
                    event && event.stopPropagation();
                    dispatch({type: Errors.MODE, mode: "all", filter});
                }}
            />}
            itemTransform={itemTransform}
            noItemsComponent={<ErrorItemComponent label={"No errors found"}/>}
            pagination={pagination}
            placeholder={<ErrorItemComponent skeleton={true}/>}
        />
        {deleteOpen && <ConfirmComponent
            children={"Errors log will be cleared."}
            confirmLabel={"Clear"}
            critical
            onCancel={() => setState({...state, deleteOpen: false})}
            onConfirm={handleConfirmDeletion}
            title={"Warning!"}
        />}
    </React.Fragment>
};

Errors.MODE = "errors_Mode";

export const errorsReducer = (state = {filter: "", mode: "all"}, action) => {
    switch (action.type) {
        case Errors.MODE:
            return {...state, filter: action.filter, mode: action.mode};
        default:
            return state;
    }
};
errorsReducer.skipStore = true;

const mapStateToProps = ({errors}) => ({
    filter: errors.filter,
    mode: errors.mode,
});

export default connect(mapStateToProps)(Errors);
