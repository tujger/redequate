import React from "react";
import {connect, useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import RefreshIcon from "@material-ui/icons/Refresh";
import IconButton from "@material-ui/core/IconButton";
import Grid from "@material-ui/core/Grid";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import MenuItem from "@material-ui/core/MenuItem";
import Toolbar from "@material-ui/core/Toolbar";
import LazyListComponent from "../../components/LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import {cacheDatas, useFirebase} from "../../controllers/General";
import ErrorItemComponent from "../../components/ErrorItemComponent";
import ConfirmComponent from "../../components/ConfirmComponent";
import {notifySnackbar} from "../../controllers/Notifications";
import AvatarView from "../../components/AvatarView";
import {errorsReducer} from "../../reducers/errorsReducer";
import {lazyListReducer} from "../../reducers/lazyListReducer";
import {progressViewReducer} from "../../reducers/progressViewReducer";

const Errors = (props) => {
    const {mode = "all", filter} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {deleteOpen, random} = state;

    const handleMode = evt => {
        dispatch({type: lazyListReducer.RESET});
        dispatch({type: errorsReducer.MODE, mode: evt.target.value, filter});
    }

    const handleConfirmDeletion = evt => {
        dispatch(progressViewReducer.SHOW);
        firebase.database().ref("errors").set(null)
            .then(() => dispatch({type: lazyListReducer.RESET}))
            .then(() => setState({...state, deleteOpen: false}))
            .catch(notifySnackbar)
            .finally(() => dispatch(progressViewReducer.HIDE))
    }

    React.useEffect(() => {
        return () => {
            dispatch(progressViewReducer.HIDE);
        }
        // eslint-disable-next-line
    }, [mode]);

    let pagination;
    let itemTransform;
    switch (mode) {
        case "all":
            pagination = new Pagination({
                child: filter ? "uid" : undefined,
                // eslint-disable-next-line no-unneeded-ternary
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
                    avatar={<AvatarView
                        alt={"Avatar"}
                        image={filteredUserData.image}
                        initials={filteredUserData.name}
                        verified={true}
                    />}
                    label={filteredUserData.name}
                    onDelete={() => {
                        dispatch({type: errorsReducer.MODE, mode, filter: ""});
                        dispatch({type: lazyListReducer.RESET});
                    }}
                />}
            </Grid>
            <IconButton onClick={() => setState({...state, deleteOpen: true})}>
                <ClearIcon/>
            </IconButton>
            <IconButton onClick={() => setState({...state, random: Math.random()})}>
                <RefreshIcon/>
            </IconButton>
        </Toolbar>
        <LazyListComponent
            key={random}
            itemComponent={item => <ErrorItemComponent
                data={item}
                key={item.key}
                onUserClick={(event, filter) => {
                    event && event.stopPropagation();
                    dispatch({type: errorsReducer.MODE, mode: "all", filter});
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


const mapStateToProps = ({errors}) => ({
    filter: errors.filter,
    mode: errors.mode,
});

export default connect(mapStateToProps)(Errors);
