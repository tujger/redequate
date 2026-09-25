import TypeIcon from "@material-ui/icons/ArrowRight";
import React from "react";
import Linkify from "react-linkify";
import {useHistory} from "react-router-dom";
import AvatarView from "../../../components/AvatarView";
import ConfirmComponent from "../../../components/ConfirmComponent";
import ItemPlaceholderComponent from "../../../components/ItemPlaceholderComponent";
import {toDateString} from "../../../controllers/DateFormat";
import {cacheDatas, usePages} from "../../../controllers/General";
import notifySnackbar from "../../../controllers/notifySnackbar";
import {UserData} from "../../../controllers/UserData";
import baseStyles from "../../../themes/Base.module.css";
import activityStyles from "./styles/ActivityItemComponent.module.css";

// eslint-disable-next-line react/prop-types
function ActivityItemComponent({data, classes: givenClasses, skeleton, label, onItemClick}) {
    const history = useHistory();
    const pages = usePages();
    const classes = {...baseStyles, ...activityStyles, ...(givenClasses || {})};
    const [state, setState] = React.useState({});
    const {alert, detailTimestamp, userData, removed, details, path, timestamp, type, userDatas = []} = state;

    const handleUserClick = uid => event => onItemClick("uid")(event, uid);

    const handleCardClick = () => {
        setState({...state, alert: true});
    };

    const handleKeyDown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleCardClick();
    };

    React.useEffect(() => {
        let isMounted = true;
        const checkIfDataValid = async () => {
            if (!data || !data.value) throw data;
            return {...data.value};
        }
        const fetchInitiatorData = async props => {
            const {uid} = props;
            if (!uid) return {...props, userData: {id: "", name: "Anonymous"}};
            if (uid === "0") return {...props, userData: {id: "0", name: "No user"}};
            return cacheDatas.fetch(uid, id => UserData().fetch(id, [UserData.NAME, UserData.IMAGE]))
                .then(userData => ({...props, userData}))
                .catch(error => catchUserFailed(uid)(error).then(userData => ({...props, userData})));
        }
        const fetchDetailsUids = async props => {
            const {details} = props;
            const {uid} = details || {};
            let uids;
            if (uid === undefined) {
                uids = [];
            } else if (uid instanceof Array) {
                uids = uid.map((item, index) => ({key: index, id: item}));
            } else if (uid instanceof Object) {
                uids = Object.keys(uid).map(item => ({key: item, id: uid[item]}));
            } else if (uid.constructor.name === "String") {
                uids = [{key: "uid", id: uid}];
            } else {
                uids = [];
            }
            return {...props, uids};
        }
        const fetchDetailsUserDatas = async props => {
            const {uids, ...rest} = props;
            const userDatas = await Promise.all(uids
                .map(async item => {
                    if (item.id === "0") return {key: item.key, userData: {id: item.id, name: "No user"}};
                    return UserData()
                        .fetch(item.id, [UserData.NAME, UserData.IMAGE])
                        .then(userData => ({key: item.key, userData}))
                        .catch(error => catchUserFailed(item.id)(error)
                            .then(userData => ({key: item.key, userData})))
                })
            );
            return {...rest, userDatas}
        }
        const fetchDetailTimestamp = async props => {
            const {details} = props;
            const {timestamp} = details || {};
            if (timestamp) {
                const detailTimestamp = new Date(timestamp).toLocaleString();
                return {...props, detailTimestamp}
            }
            return props;
        }
        const fetchDetailPost = async props => {
            const {details} = props;
            const {postId, path} = details || {};
            if (postId && path) {
                return {...props, path};
            }
            return props;
        }
        const updateState = async props => {
            isMounted && setState(state => ({...state, ...props}));
        }
        const catchEvent = async event => {
            if (event instanceof Error) throw event;
            if (event) console.warn(event);
        }
        const catchUserFailed = uid => async error => {
            console.warn(error);
            return {id: uid, name: "Some user"};
        }
        const finalize = async () => {
        }

        checkIfDataValid()
            .then(fetchInitiatorData)
            .then(fetchDetailsUids)
            .then(fetchDetailsUserDatas)
            .then(fetchDetailTimestamp)
            .then(fetchDetailPost)
            .then(updateState)
            .catch(catchEvent)
            .catch(notifySnackbar)
            .finally(finalize);

        return () => {
            isMounted = false;
        }
    }, [data])

    if (removed) return null;
    if (label) return <ItemPlaceholderComponent classes={classes} label={label} pattern={"flat"}/>;
    if (skeleton || !type) return <ItemPlaceholderComponent classes={classes} pattern={"flat"}/>;

    return <div
        className={[classes.card, classes.cardFlat, classes.cardActionArea, baseStyles.ripple].join(" ")}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        role='button'
        tabIndex={0}
    >
        <div className={classes.cardHeader}>
            <div className={classes.avatarWrapper} onClick={handleUserClick(userData.id)}>
                <AvatarView
                    className={classes.avatarSmall}
                    image={userData.image}
                    initials={userData.name}
                    verified={true}
                />
            </div>
            <div className={classes.cardContent}>
                <div className={classes.titleRow}>
                    <div className={classes.userName} onClickCapture={handleUserClick(userData.id)}>
                        {userData.name}
                    </div>
                    <div className={classes.date}>
                        {toDateString(timestamp)}
                    </div>
                </div>
                <div className={classes.details}>
                    <div className={classes.typeRow} onClick={event => onItemClick("type")(event, type)}>
                        <TypeIcon className={classes.typeIcon}/>
                        <span>{type}</span>
                    </div>
                    <div className={classes.subheader}>
                        {(JSON.stringify(details) || "").substr(0, 100)}
                    </div>
                </div>
            </div>
        </div>
        {alert && <ConfirmComponent
            cancelLabel={"Close"}
            confirmLabel={null}
            onCancel={() => setState({...state, alert: false})}
            title={"Details"}
        >
            <Linkify><pre style={{whiteSpace: "pre-wrap"}}>{
                typeof details === "object"
                    ? JSON.stringify(details, null, "   ")
                    : details
            }</pre></Linkify>
            <h6 className={classes.contextTitle}>Context</h6>
            <div className={classes.contextRow}>Activity: {type}</div>
            {userDatas && userDatas.map((item, index) => <div className={classes.contextRow} key={index}>
                <span>{item.key}:</span>
                <span className={classes.userName} onClickCapture={evt => {
                    evt && evt.stopPropagation();
                    if (history.unblock) {
                        history.unblock();
                        history.unblock = null;
                    }
                    history.push(pages.user.route + item.userData.id)
                }}>
                    {item.userData.name}
                </span>
            </div>)}
            {path && <div className={classes.contextRow}>
                <span>Post:</span>
                <span className={classes.userName} onClickCapture={evt => {
                    evt && evt.stopPropagation();
                    if (history.unblock) {
                        history.unblock();
                        history.unblock = null;
                    }
                    history.push(pages.post.route + path)
                }}>
                    open if exists
                </span>
            </div>}
            {detailTimestamp && <div className={classes.contextRow}>Timestamp: {detailTimestamp}</div>}
        </ConfirmComponent>}
    </div>
}

export default ActivityItemComponent;
