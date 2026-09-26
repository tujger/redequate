import React from "react";
import {useHistory} from "react-router-dom";
import {useDispatch} from "react-redux";
import {useCurrentUserData} from "../controllers/UserData";
import {useFirebase, usePages} from "../controllers/General";
import ProgressView from "../components/ProgressView";
import notifySnackbar from "../controllers/notifySnackbar";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import AvatarView from "../components/AvatarView";
import {toDateString} from "../controllers/DateFormat";
import baseStyles from "../themes/Base.module.css";
import alertStyles from "./styles/AlertItem.module.css";

const AlertItem = ({data, skeleton, label, fetchAlertContent}) => {
    const currentUserData = useCurrentUserData();
    const dispatch = useDispatch();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({});
    const {new: isNew, type, id, timestamp, avatar, title, text, removed, route} = state

    const handleClick = () => {
        dispatch(ProgressView.SHOW);
        firebase.database().ref("alerts").child(currentUserData.id).child(data.key).child("new").set(null)
            .then(() => {
                try {
                    delete data.value.new;
                } catch (ignored) {
                }
                setState({...state, isNew: false});
                if (route) history.push(route);
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    React.useEffect(() => {
        if (!data) return;
        let isMounted = true;
        fetchAlertContent({firebase, pages}, data.value)
            .then(result => isMounted && setState(state => ({...state, ...data.value, ...result})))
            .catch(error => {
                isMounted && setState(state => ({...state, removed: true}));
                console.error(data.value, error);
            })
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, []);

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent label={label} classes={null} pattern={"flat"}/>
    if (skeleton || !type) return <ItemPlaceholderComponent classes={null} pattern={"flat"}/>;

    return <div className={[alertStyles.card, alertStyles.cardFlat].join(" ")}>
        <div
            className={[alertStyles.root, alertStyles.cardActionArea, baseStyles.ripple].join(" ")}
            onClick={handleClick}
            onKeyDown={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleClick();
            }}
            role='button'
            tabIndex={0}
        >
            <div className={alertStyles.cardHeader}>
                <div className={alertStyles.avatarWrapper}>
                    <AvatarView
                        className={alertStyles.avatarSmall}
                        icon={avatar}
                        initials={type}
                        verified={true}
                    />
                </div>
                <div className={alertStyles.cardContent}>
                    <div className={alertStyles.titleRow}>
                        <div className={[alertStyles.userName, isNew ? alertStyles.unread : alertStyles.read].join(" ")}>
                            {title}
                        </div>
                        {timestamp && <div
                            className={alertStyles.date}
                            title={new Date(timestamp).toLocaleString()}
                        >
                            {toDateString(timestamp)}
                        </div>}
                    </div>
                    <div className={[alertStyles.subheader, isNew ? alertStyles.unread : alertStyles.read].join(" ")}>
                        {text || id}
                    </div>
                </div>
            </div>
        </div>
    </div>
}

export default AlertItem;
