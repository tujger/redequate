import React from "react";
import {useDispatch} from "react-redux";
import {useHistory} from "react-router-dom";
import AvatarView from "../components/AvatarView";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import ListItemComponent from "../components/ListItemComponent";
import ProgressView from "../components/ProgressView";
import {useFirebase, usePages} from "../controllers/General";
import notifySnackbar from "../controllers/notifySnackbar";
import {useCurrentUserData} from "../controllers/UserData";
import UserName from "../controls/UserName/UserName";
import alertStyles from "./styles/AlertItem.module.css";

export default ({data, skeleton, label, fetchAlertContent}) => {
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

    return <ListItemComponent
        avatar={<AvatarView
            icon={avatar}
            initials={type}
            size={"small"}
            verified={true}
        />}
        timestamp={timestamp}
        title={<UserName
            className={[isNew ? alertStyles.unread : alertStyles.read].join(" ")}
            id={currentUserData.id}
        >{title}</UserName>}
        onClick={handleClick}
        onKeyDown={event => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            handleClick();
        }}
    >
        <div className={[isNew ? alertStyles.unread : alertStyles.read].join(" ")}>
            {text || id}
        </div>
    </ListItemComponent>
}
