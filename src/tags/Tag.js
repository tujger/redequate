import React from "react";
import {useHistory, useParams} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";
import FixIcon from "@material-ui/icons/BugReport";
import {useDispatch} from "react-redux";
import AddIcon from "@material-ui/icons/Add";
import EditIcon from "@material-ui/icons/Edit";
import {mentionTags, mentionUsers} from "../controllers/mentionTypes";
import {fetchCallable} from "../controllers/Firebase";
import notifySnackbar from "../controllers/notifySnackbar";
import {lazyListComponentReducer} from "../components/LazyListComponent/lazyListComponentReducer";
import ProgressView from "../components/ProgressView";
import Pagination from "../controllers/FirebasePagination";
import LoadingComponent from "../components/LoadingComponent";
import NavigationToolbar from "../components/NavigationToolbar";
import MentionedTextComponent from "../components/MentionedTextComponent";
import PostComponent from "../components/PostComponent/PostComponent";
import postItemTransform from "../components/PostComponent/postItemTransform";
import LazyListComponent from "../components/LazyListComponent/LazyListComponent";
import {matchRole, Role, useCurrentUserData} from "../controllers/UserData";
import {useFirebase, usePages, useWindowData} from "../controllers/General";
import MutualComponent from "../components/MutualComponent/MutualComponent";
import NewPostComponent from "../components/NewPostComponent/NewPostComponent";
import {styles} from "../controllers/Theme";
import InfoComponent from "../components/InfoComponent";
import ShareComponent from "../components/ShareComponent";
import ActionComponent from "../components/MutualComponent/ActionComponent";
import FlexFabComponent from "../components/FlexFabComponent";
import ShareIcon from "@material-ui/icons/Share";

const stylesCurrent = theme => ({
    follow: {
        borderColor: theme.palette.secondary.main,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: "initial",
        textTransform: "initial",
    },
    profileFields: {
        marginBottom: 0,
    },
    profileFieldImage: {
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(40),
        },
    },
    profileImage: {
        borderRadius: theme.spacing(2),
    },
});

const Tag = ({classes, allowOwner = true}) => {
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages()
    const [state, setState] = React.useState({disabled: false});
    const {tag} = state;
    const dispatch = useDispatch();
    const db = firebase.database();
    const currentUserData = useCurrentUserData();
    const windowData = useWindowData();
    const {id: itemId} = useParams();

    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);
    const isOwner = allowOwner && tag && tag.value && tag.value.uid && tag.value.uid === currentUserData.id;

    const fixErrors = () => {
        fetchCallable(firebase)("fixTag", {
            key: tag.id
        })
            .then(({result = "Complete"}) => notifySnackbar(result))
            .catch(notifySnackbar)
            .finally(() => dispatch(ProgressView.HIDE));
    }

    React.useEffect(() => {
        let isMounted = true;
        dispatch(ProgressView.SHOW);
        dispatch({type: lazyListComponentReducer.RESET});
        firebase.database().ref("tag").child(itemId).once("value")
            .then(snapshot => {
                if (snapshot.exists()) return {key: snapshot.key, value: snapshot.val()};
                return Pagination({
                    ref: firebase.database().ref("tag"),
                    child: "id",
                    equals: itemId,
                    size: 1
                }).next().then(items => items[0])
            })
            .then(tag => {
                const isOwner = allowOwner && tag.value.uid === currentUserData.id;
                if (tag.value.hidden && !isCurrentUserAdmin && !isOwner) {
                    history.goBack();
                } else {
                    history.replace(pages.tag.route + tag.value.id);
                    isMounted && setState(state => ({...state, tag}))
                }
            })
            .catch(error => {
                console.error(itemId, error);
                // notifySnackbar(Error(`Cannot open "${itemId}" properties`));
                history.goBack();
            })
            .finally(() => dispatch(ProgressView.HIDE))
        return () => {
            isMounted = false;
        }
        // eslint-disable-next-line
    }, [itemId]);

    console.log(isOwner, allowOwner && tag && tag.value && tag.value.uid && tag.value.uid === currentUserData.id)
    if (!tag) return <LoadingComponent/>

    return <>
        <NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            className={classes.top}
            mediumButton={<>
                {isCurrentUserAdmin && <IconButton
                    aria-label={"Fix possible errors"}
                    children={<FixIcon/>}
                    onClick={fixErrors}
                    title={"Fix possible errors"}
                />}
                {(isCurrentUserAdmin || isOwner) && <IconButton
                    aria-label={"Edit"}
                    children={<EditIcon/>}
                    onClick={() => history.push(pages.edittag.route + tag.key)}
                    title={"Edit"}
                />}
            </>}
            rightButton={<ShareComponent
                component={<IconButton
                    aria-label={"Invite"}
                    children={<ShareIcon/>}
                />}
                text={"Share"}
                title={"Share"}
                url={window.location.origin + pages.tag.route + tag.value.id}
            />}
        />
        <Grid container className={classes.center}>
            <Grid container className={classes.profile}>
                {tag.value.image && <Grid item className={classes.profileFieldImage}>
                    <img
                        alt={""}
                        className={classes.profileImage}
                        src={tag.value.image}
                    />
                </Grid>}
                <Grid item className={classes.profileFields}>
                    <Grid container className={classes.profileField}>
                        <Typography variant={"h6"} style={{whiteSpace: "pre-wrap"}}>
                            {tag.value.label} {tag.value.hidden && <>(hidden)</>}
                        </Typography>
                    </Grid>
                    <Grid container className={classes.profileField}>
                        <Typography variant={"body2"} style={{whiteSpace: "pre-wrap"}}>
                            <MentionedTextComponent
                                mentions={[mentionTags, mentionUsers]}
                                text={tag.value.description}
                            />
                        </Typography>
                    </Grid>
                    <Grid container spacing={1} className={classes.profileField}>
                        {/*<ShareComponent
                            component={<ActionComponent label={"Invite"}/>}
                            text={"Share"}
                            title={"Share"}
                            url={window.location.origin + pages.tag.route + tag.value.id}
                        />*/}
                        <MutualComponent
                            counterComponent={<InfoComponent suffix={"follower(s)"}/>}
                            mutualId={tag.key}
                            mutualType={"tag"}
                            typeId={"watching"}
                            subscribeComponent={<ActionComponent label={"Follow"}/>}
                            unsubscribeComponent={<ActionComponent label={"Unfollow"} variant={"outlined"}/>}
                            counter={false}
                            // unsubscribeComponent={<ActionComponent label={"Unfollow"}/>}
                        />
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
        <Grid container className={classes.center}>
            <LazyListComponent
                itemComponent={item => <PostComponent
                    key={item.id}
                    mentions={[mentionUsers, mentionTags]}
                    postData={item}
                    userData={item._userData}
                />}
                itemTransform={postItemTransform({
                    fetchItemId: item => item.key,
                    onItemError: (error, options) => {
                        console.log(error, options);
                        fetchCallable(firebase)("fixMutualStamp", {
                            ...options,
                            id: options.id,
                            tag: tag.key,
                            typeId: "watching"
                        }).then(console.log)
                            .catch(console.error);
                    }
                })}
                live
                noItemsComponent={<PostComponent label={"No posts found"}/>}
                pagination={() => new Pagination({
                    ref: db.ref("_tag").child(tag.key),
                    order: "desc",
                })}
                placeholder={<PostComponent skeleton={true}/>}
            />
        </Grid>
        {!tag.value.hidden && <NewPostComponent
            buttonComponent={<FlexFabComponent
                icon={<AddIcon/>}
                label={"New post"}
            />}
            context={tag.value.id}
            mentions={[mentionTags, mentionUsers]}
            onBeforePublish={async data => {
                data.text += `${String.fromCharCode(1)}$[tag:${tag.value.id}:${tag.key}]${String.fromCharCode(2)}`
                return data;
            }}
            onComplete={({key}) => {
                dispatch({type: lazyListComponentReducer.RESET});
                history.push(pages.post.route + key);
            }}
            onError={error => {
                console.error(error)
            }}
            UploadProps={windowData.isNarrow() ? {camera: false} : undefined}
        />}
    </>
};

export default withStyles(stylesCurrent)(withStyles(styles)(Tag));
