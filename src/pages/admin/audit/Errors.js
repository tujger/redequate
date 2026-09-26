import React from "react";
import {connect, useDispatch} from "react-redux";
import ClearIcon from "@material-ui/icons/Clear";
import RefreshIcon from "@material-ui/icons/Refresh";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import Select from "../../../controls/Select/Select";
import Chip from "../../../controls/Chip/Chip";
import Pagination from "../../../controllers/FirebasePagination";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import ProgressView from "../../../components/ProgressView";
import ErrorItemComponent from "./ErrorItemComponent";
import ConfirmComponent from "../../../components/ConfirmComponent";
import AvatarView from "../../../components/AvatarView";
import notifySnackbar from "../../../controllers/notifySnackbar";
import NavigationToolbar from "../../../components/NavigationToolbar";
import {lazyListComponentReducer} from "../../../components/LazyListComponent/lazyListComponentReducer";
import {auditReducer} from "./auditReducer";
import errorStyles from "./styles/Errors.module.css";

// eslint-disable-next-line react/prop-types
const Errors = props => {
    const {classes: givenClasses, errorsMode = "all", errorsFilter} = props;
    const classes = {...errorStyles, ...(givenClasses || {})};
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {deleteOpen, random} = state;

    const handleMode = evt => {
        dispatch({type: lazyListComponentReducer.RESET});
        dispatch({type: auditReducer.ERRORS, errorsMode: evt.target.value, errorsFilter});
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
    }, [errorsMode]);

    let pagination;
    let itemTransform;
    switch (errorsMode) {
        case "all":
            pagination = new Pagination({
                child: errorsFilter ? "uid" : undefined,
                // eslint-disable-next-line no-unneeded-ternary
                equals: errorsFilter ? errorsFilter : undefined,
                order: "desc",
                ref: "errors",
            })
            itemTransform = item => item;
            break;
        default:
    }

    const filteredUserData = errorsFilter ? cacheDatas.get(errorsFilter) : null;

    const clearFilteredUser = () => {
        dispatch({type: auditReducer.ERRORS, errorsMode, errorsFilter: ""});
        dispatch({type: lazyListComponentReducer.RESET});
    };

    return <>
        <NavigationToolbar
            backButton={null}
            className={classes.topSticky}
            mediumButton={<button
                aria-label='Clear errors'
                className={classes.iconButton}
                onClick={() => setState({...state, deleteOpen: true})}
                type='button'
            >
                <ClearIcon/>
            </button>}
            rightButton={<button
                aria-label='Refresh errors'
                className={classes.iconButton}
                onClick={() => setState({...state, random: Math.random()})}
                type='button'
            >
                <RefreshIcon/>
            </button>}
        >
            <Select
                onChange={handleMode}
                options={[{label: "All", value: "all"}]}
                value={errorsMode}
            />
            {errorsMode === "all" && filteredUserData && <Chip
                avatar={<AvatarView
                    alt={"Avatar"}
                    image={filteredUserData.image}
                    initials={filteredUserData.name}
                    verified={true}
                />}
                label={filteredUserData.name}
                onDelete={clearFilteredUser}
            />}
        </NavigationToolbar>
        <div className={classes.center}>
            <LazyListComponent
                key={random}
                itemComponent={item => <ErrorItemComponent
                    data={item}
                    key={item.key}
                    onUserClick={(event, errorsFilter) => {
                        event && event.stopPropagation();
                        dispatch({type: auditReducer.ERRORS, errorsMode: "all", errorsFilter});
                    }}
                />}
                itemTransform={itemTransform}
                noItemsComponent={<ErrorItemComponent label={"No errors found"}/>}
                pagination={pagination}
                placeholder={<ErrorItemComponent skeleton={true}/>}
            />
        </div>
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

const mapStateToProps = ({audit}) => ({
    errorsFilter: audit.errorsFilter,
    errorsMode: audit.errorsMode,
});

export default connect(mapStateToProps)(Errors);
