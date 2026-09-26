import ClearIcon from "@material-ui/icons/Clear";
import React from "react";
import {useDispatch} from "react-redux";
import AvatarView from "../../../components/AvatarView";
import ConfirmComponent from "../../../components/ConfirmComponent";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import ProgressView from "../../../components/ProgressView";
import {toDateString} from "../../../controllers/DateFormat";
import {fetchCallable} from "../../../controllers/Firebase";
import {cacheDatas, useFirebase} from "../../../controllers/General";
import notifySnackbar from "../../../controllers/notifySnackbar";
import {UserData} from "../../../controllers/UserData";
import useRippleEffect from "../../../helpers/useRippleEffect";
import baseStyles from "../../../themes/Base.module.css";
import errorStyles from "./styles/ErrorItemComponent.module.css";

// eslint-disable-next-line react/prop-types
function ErrorItemComponent({data, classes: givenClasses, skeleton, label, onUserClick}) {
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const onPointerDown = useRippleEffect();
    const classes = {...baseStyles, ...errorStyles, ...(givenClasses || {})};
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
        fetchCallable("fixError", {
            key: data.key
        })
            .then(({result}) => notifySnackbar(result))
            .then(() => firebase.database().ref("errors").child(data.key).set(null))
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    const handleRemove = () => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("errors").child(data.key).set(null)
            .then(() => setState({...state, removed: true}))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        if (!data || !data.value || !data.value.uid) return;
        let isMounted = true;
        const userData = cacheDatas.put(data.value.uid, UserData());
        userData.fetch(data.value.uid, [UserData.NAME, UserData.IMAGE])
            .then(() => isMounted && setState(state => ({...state, userData})))
            .catch(error => {
                if (!isMounted) return;
                console.log(error, userData)
                userData.public.name = userData.public.name || (data.value.uid === "anonymous" ? "Anonymous" : "User deleted");
                if (data.value.uid !== "anonymous") console.log("[Error] user deleted", data.value.uid);
                setState(state => ({...state, userData}))
            });
        return () => {
            isMounted = false;
        }
    }, [])

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent classes={classes} label={label} pattern={"flat"}/>;
    if (skeleton || !userData) return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>;

    return <div
        className={[classes.card, classes.cardFlat, classes.cardActionArea].join(" ")}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        role='button'
        tabIndex={0}
    >
        <div className={classes.cardHeader}>
            <div className={classes.avatarWrapper} onClick={handleClick}>
                <AvatarView
                    className={classes.avatar}
                    image={userData.image}
                    initials={userData.name}
                    onclick={event => onUserClick(event, userData.id)}
                    verified={true}
                />
            </div>
            <div className={classes.cardContent}>
                <div className={classes.titleRow}>
                    <div className={classes.userName} onClickCapture={handleClick}>
                        {userData.name}
                    </div>
                    <div className={classes.date}>
                        {toDateString(data.value.timestamp)}
                    </div>
                </div>
                <div className={classes.subheader}>
                    {(JSON.stringify(data.value.error) || "").substr(0, 100)}
                </div>
            </div>
            <button
                aria-label='Remove error'
                className={classes.removeButton}
                onClick={event => {
                    event.stopPropagation();
                    handleRemove();
                }}
                type='button'
            >
                <ClearIcon/>
            </button>
        </div>
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
    </div>
}

export default ErrorItemComponent;
