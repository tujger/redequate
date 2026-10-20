import ClearIcon from "@mui/icons-material/Clear";
import React from "react";
import {useDispatch} from "react-redux";
import AvatarView from "../../../components/AvatarView";
import ConfirmComponent from "../../../components/ConfirmComponent";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import ListItemComponent from "../../../components/ListItemComponent";
import ProgressView from "../../../components/ProgressView";
import {useBackend, useDatabase} from "../../../controllers";
import {cacheDatas} from "../../../controllers/General";
import notifySnackbar from "../../../controllers/notifySnackbar";
import {UserData} from "../../../controllers/UserData";
import Button from "../../../controls/Button/Button";
import errorStyles from "./styles/ErrorItemComponent.module.css";

export default ({data, skeleton, label, onUserClick}) => {
    const backend = useBackend();
    const database = useDatabase();
    const dispatch = useDispatch();
    const [state, setState] = React.useState({});

    const {alert, userData, removed} = state;

    const handleClick = event => onUserClick(event, userData.id);

    const handleCardClick = () => {
        setState({...state, alert: true});
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleCardClick();
    };

    const handleConfirm = () => {
        dispatch(ProgressView.SHOW);
        setState({...state, alert: false});
        console.log("[Error] try to fix", data);
        backend.request("fixError", {
            key: data.key
        })
            .then(({result}) => notifySnackbar(result))
            .then(() => database.delete(["errors", {id: data.key, _: true}]))
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleRemove = () => {
        dispatch(ProgressView.SHOW);
        database.delete(["errors", {id: data.key, _: true}])
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        if (!data || !data.value || !data.value.uid) return;
        let isMounted = true;

        cacheDatas.fetch(data.value.uid, id => new UserData(database).fetch(id, [UserData.NAME, UserData.IMAGE]))
            .then(userData => isMounted && setState(state => ({...state, userData})))
            .catch(error => {
                if (!isMounted) return;
                const userData = new UserData(database);
                userData.public.name = data.value.uid === "anonymous" ? "Anonymous" : "User deleted";
                if (data.value.uid !== "anonymous") console.log("[Error] user deleted", data.value.uid);
                setState(state => ({...state, userData}))
            });
        return () => {
            isMounted = false;
        }
    }, [])

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent classes={errorStyles} label={label} pattern={"flat"}/>;
    if (skeleton || !userData) return <ItemPlaceholderComponent classes={errorStyles} pattern={"flat"}/>;

    return <>
        <ListItemComponent
            avatar={<AvatarView
                image={userData.image}
                initials={userData.name}
                onclick={event => onUserClick(event, userData.id)}
                size={"small"}
                verified={true}
            />}
            leftAction={{
                action: handleRemove,
                label: "Remove"
            }}
            tabIndex={0}
            timestamp={data.value.timestamp}
            title={<div className={errorStyles.userName} onClickCapture={handleClick}>
                {userData.name}
            </div>}
            menu={<Button
                className={errorStyles.removeButton}
                icon={<ClearIcon/>}
                onClick={event => {
                    event.stopPropagation();
                    handleRemove();
                }}
                title={"Remove error"}
            />}
            onClick={handleCardClick}
            onKeyDown={handleKeyDown}
        >
            {(JSON.stringify(data.value.error) || "").substr(0, 100)}
        </ListItemComponent>
        {alert && <ConfirmComponent
            confirmLabel={"Try to fix"}
            onCancel={() => setState({...state, alert: false})}
            onConfirm={handleConfirm}
            title={"Error stacktrace"}
        >
            <pre style={{whiteSpace: "pre-wrap"}}>{
                typeof data.value.error === "object"
                    ? JSON.stringify(data.value.error, null, "   ")
                    : data.value.error
            }</pre>
        </ConfirmComponent>}
    </>
}
