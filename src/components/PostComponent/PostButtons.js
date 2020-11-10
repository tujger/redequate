import React from "react";
import {useHistory} from "react-router-dom";
import IconButton from "@material-ui/core/IconButton";
import LikeEmptyIcon from "@material-ui/icons/ThumbUpOutlined";
import DislikeEmptyIcon from "@material-ui/icons/ThumbDownOutlined";
import LikeFilledIcon from "@material-ui/icons/ThumbUp";
import DislikeFilledIcon from "@material-ui/icons/ThumbDown";
import ChatEmptyIcon from "@material-ui/icons/ChatBubbleOutline";
import ChatFilledIcon from "@material-ui/icons/Chat";
import ReplyIcon from "@material-ui/icons/ReplyOutlined";
import ClearIcon from "@material-ui/icons/Clear";
import ShareIcon from "@material-ui/icons/Share";
import Grid from "@material-ui/core/Grid";
import {useDispatch} from "react-redux";
import {cacheDatas, delay, useFirebase, usePages} from "../../controllers/General";
import {matchRole, Role, useCurrentUserData} from "../../controllers/UserData";
import notifySnackbar from "../../controllers/notifySnackbar";
import ProgressView from "../ProgressView";
import InfoComponent from "../InfoComponent";
import MentionedTextComponent from "../MentionedTextComponent";
import ShareComponent from "../ShareComponent";
import ConfirmComponent from "../ConfirmComponent";
import NewPostComponent from "../NewPostComponent/NewPostComponent";

export default ({allowedExtras, postData, userData, classes = {}, showRepliesCounter = true, mentions, onChange, onDelete, isReply = false, type}) => {
    const [state, setState] = React.useState({});
    const {
        deletePost,
        disabled
    } = state;
    const history = useHistory();
    const pages = usePages();
    const firebase = useFirebase();
    const dispatch = useDispatch();
    const currentUserData = useCurrentUserData();

    const handleClickExtra = extraType => evt => {
        evt && evt.stopPropagation();
        if (disabled) return;
        if (!currentUserData || !currentUserData.id) {
            history.push(pages.login.route);
            return;
        }
        if (!isPostingAllowed) {
            history.push(pages.profile.route);
            return;
        }
        setState(state => ({...state, disabled: true}))
        postData[postData.extra(extraType) ? "removeExtra" : "putExtra"]({type: extraType, uid: currentUserData.id})
            // .then(postData.fetchCounters)
            .then(postData => setState(state => ({...state, postData})))
            .then(() => delay(1000))
            .then(() => setState(state => ({...state, disabled: false})))
            .catch(notifySnackbar)
    }

    const handleClickDelete = evt => {
        evt && evt.stopPropagation();
        setState(state => ({...state, deletePost: true}));
    }

    const handleConfirmDeletion = () => {
        setState(state => ({...state, deletePost: false}));
        if (!postData.id) return;
        dispatch(ProgressView.SHOW);
        firebase.database().ref(type).child(postData.id).set(null)
            .then(() => {
                notifySnackbar({title: "Post successfully deleted."});
                setTimeout(() => {
                    onChange && onChange();
                    onDelete && onDelete(postData);
                }, 5000)
            })
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE))
    }

    const handleCancelDeletion = () => {
        setState(state => ({...state, deletePost: false}));
    }

    const isPostingAllowed = matchRole([Role.ADMIN, Role.USER], currentUserData);
    const isDeleteAllowed = currentUserData && !currentUserData.disabled && (postData.uid === currentUserData.id || matchRole([Role.ADMIN], currentUserData))

    // return React.useMemo(() => {
    return <>
        <Grid className={classes.cardActions}>
            {allowedExtras.indexOf("like") >= 0 && <Grid item>
                <IconButton
                    aria-label={"Like"}
                    component={"div"}
                    onClick={handleClickExtra("like")}
                    size={"small"}
                    title={"Like"}
                >
                    {postData.extra("like") ? <LikeFilledIcon/> : <LikeEmptyIcon/>}
                    <span className={classes.counter}>{postData.counter("like")}</span>
                </IconButton>
            </Grid>}
            {allowedExtras.indexOf("dislike") >= 0 && <Grid item>
                <IconButton
                    aria-label={"Dislike"}
                    component={"div"}
                    onClick={handleClickExtra("dislike")}
                    size={"small"}
                    title={"Dislike"}
                >
                    {postData.extra("dislike") ? <DislikeFilledIcon/> : <DislikeEmptyIcon/>}
                    <span className={classes.counter}>{postData.counter("dislike")}</span>
                </IconButton>
            </Grid>}
            {showRepliesCounter && <Grid item>
                <IconButton
                    component={"div"}
                    size={"small"}
                >
                    {postData.counter("replied") ? <ChatFilledIcon/> : <ChatEmptyIcon/>}
                    <span className={classes.counter}>{postData.counter("replied")}</span>
                </IconButton>
            </Grid>}
            <Grid item>
                <NewPostComponent
                    buttonComponent={<IconButton
                        aria-label={"Reply"}
                        children={<ReplyIcon/>}
                        component={"div"}
                        size={"small"}
                        title={"Reply"}
                    />}
                    context={postData.id}
                    infoComponent={<InfoComponent style={{maxHeight: 100, overflow: "auto"}}
                    >
                        <MentionedTextComponent
                            className={classes.body}
                            mentions={mentions}
                            tokens={postData.tokens}
                        />
                    </InfoComponent>}
                    mentions={mentions}
                    onComplete={key => {
                        console.log(key)
                        cacheDatas.remove(postData.id);
                        onChange();
                    }}
                    onError={notifySnackbar}
                    replyTo={postData.id}
                    text={`$[user:${postData.uid}:${userData.name}] `}
                />
            </Grid>
            {!isReply && <Grid item>
                <ShareComponent
                    component={<IconButton
                        aria-label={"Share"}
                        children={<ShareIcon/>}
                        component={"div"}
                        size={"small"}
                        title={"Share"}
                    />}
                    text={"Share"}
                    title={"Share"}
                    url={window.location.origin + pages.post.route + postData.id}
                />
            </Grid>}
            <Grid item>
                <IconButton
                    aria-label={"Delete"}
                    children={<ClearIcon/>}
                    className={isDeleteAllowed ? null : classes.hidden}
                    component={"div"}
                    onClick={isDeleteAllowed ? handleClickDelete : null}
                    size={"small"}
                    title={"Delete"}
                />
            </Grid>
        </Grid>
        {deletePost && <ConfirmComponent
            children={"Your post and all replies will be deleted."}
            confirmLabel={"Delete"}
            critical
            onCancel={handleCancelDeletion}
            onConfirm={handleConfirmDeletion}
            title={"Delete post?"}
        />}
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
