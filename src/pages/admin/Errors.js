import React from "react";
import {connect, useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import RefreshIcon from "@material-ui/icons/Refresh";
import IconButton from "@material-ui/core/IconButton";
import Select from "@material-ui/core/Select";
import Chip from "@material-ui/core/Chip";
import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import LazyListComponent from "../../components/LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import {cacheDatas, useFirebase} from "../../controllers/General";
import ProgressView from "../../components/ProgressView";
import ErrorItemComponent from "../../components/ErrorItemComponent";
import ConfirmComponent from "../../components/ConfirmComponent";
import AvatarView from "../../components/AvatarView";
import {notifySnackbar} from "../../controllers/notifySnackbar";
import {errorsReducer} from "../../reducers/errorsReducer";
import NavigationToolbar from "../../components/NavigationToolbar";
import {lazyListComponentReducer} from "../../components/LazyListComponent/lazyListComponentReducer";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "../../controllers/Theme";

const Errors = (props) => {
    const {classes, mode = "all", filter} = props;
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {deleteOpen, random} = state;

    const handleMode = evt => {
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: errorsReducer.MODE, mode: evt.target.value, filter});
    }

    const handleConfirmDeletion = evt => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("errors").set(null)
            .then(() => dispatch({type: lazyListComponentReducer.RESET}))
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
                // eslint-disable-next-line no-unneeded-ternary
                equals: filter ? filter : undefined,
                order: "desc",
                ref: firebase.database().ref("errors"),
            })
            itemTransform = item => item;
            break;
        default:
    }

    const filteredUserData = filter ? cacheDatas.get(filter) : null;

    return <>
        <NavigationToolbar
            backButton={null}
            className={classes.topSticky}
            mediumButton={<IconButton
                children={<ClearIcon/>}
                onClick={() => setState({...state, deleteOpen: true})}
            />}
            rightButton={<IconButton
                children={<RefreshIcon/>}
                onClick={() => setState({...state, random: Math.random()})}
            />}
        >
            <Select
                color={"secondary"}
                onChange={handleMode}
                value={mode}
            >
                <MenuItem value={"all"}>All errors</MenuItem>
            </Select>
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
                    dispatch({type: lazyListComponentReducer.RESET});
                }}
            />}
        </NavigationToolbar>
        <Grid container className={classes.center}>
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
        </Grid>
        {deleteOpen && <ConfirmComponent
            children={"Errors log will be cleared."}
            confirmLabel={"Clear"}
            critical
            onCancel={() => setState({...state, deleteOpen: false})}
            onConfirm={handleConfirmDeletion}
            title={"Warning!"}
        />}
    </>
};

const mapStateToProps = ({errors}) => ({
    filter: errors.filter,
    mode: errors.mode,
});

export default connect(mapStateToProps)(withStyles(styles)(Errors));
