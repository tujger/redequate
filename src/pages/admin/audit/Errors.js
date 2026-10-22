import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import React from "react";
import {connect, useDispatch} from "react-redux";
import {DatabaseOrder} from "../../../../packages/database/src";
import AvatarView from "../../../components/AvatarView";
import ConfirmComponent from "../../../components/ConfirmComponent";
import LazyListComponent from "../../../components/LazyListComponent/LazyListComponent";
import LoadingComponent from "../../../components/LoadingComponent";
import NavigationToolbar from "../../../components/NavigationToolbar";
import ProgressView from "../../../components/ProgressView";
import {useDatabase, useRedirectToLogin} from "../../../controllers";
import {cacheDatas, Layout} from "../../../controllers/General";
import notifySnackbar from "../../../controllers/notifySnackbar";
import Button from "../../../controls/Button/Button";
import Chip from "../../../controls/Chip/Chip";
import Select from "../../../controls/Select/Select";
import baseStyles from "../../../themes/Base.module.css";
import auditReducer from "./auditReducer";
import ErrorItemComponent from "./ErrorItemComponent";

const Errors = props => {
    const {errorsMode = "all", errorsFilter} = props;
    const database = useDatabase();
    const dispatch = useDispatch();
    const shouldRedirectToLogin = useRedirectToLogin();
    const [state, setState] = React.useState({});

    const {deleteOpen} = state;

    const handleMode = evt => {
        dispatch({type: auditReducer.ERRORS, errorsMode: evt.target.value, errorsFilter});
    }

    const handleConfirmDeletion = evt => {
        dispatch(ProgressView.SHOW);
        database.delete(["errors"])
            .then(() => dispatch({type: Layout.REFRESH}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    React.useEffect(() => {
        return () => {
            dispatch(ProgressView.HIDE);
        }
    }, [errorsMode]);

    if (shouldRedirectToLogin) return <LoadingComponent/>;

    const cursor = database.cursor(["errors"], {
        equalTo: errorsFilter || undefined,
        order: DatabaseOrder.DESC,
        orderBy: errorsFilter ? ["uid"] : undefined,
    });

    const listItemTransform = async data => ({
        data,
        onUserClick: (event, errorsFilter) => {
            event && event.stopPropagation();
            dispatch({type: auditReducer.ERRORS, errorsMode: "all", errorsFilter});
        }
    })

    const filteredUserData = errorsFilter ? cacheDatas.get(errorsFilter) : null;

    const clearFilteredUser = () => {
        dispatch({type: auditReducer.ERRORS, errorsMode, errorsFilter: ""});
    };

    return <>
        <NavigationToolbar
            backButton={null}
            mediumButton={<Button
                icon={<ClearIcon/>}
                onClick={() => setState({...state, deleteOpen: true})}
                title={"Clear errors"}
            />}
            rightButton={<Button
                icon={<RefreshIcon/>}
                onClick={() => dispatch({type: Layout.REFRESH})}
                title={"Refresh errors"}
            />}
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
        <div className={[baseStyles.content].filter(Boolean).join(" ")}>
            <LazyListComponent
                cursor={cursor}
                ItemComponent={ErrorItemComponent}
                itemTransform={listItemTransform}
                noItemsComponent={<ErrorItemComponent label={"No errors found"}/>}
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
