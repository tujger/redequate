import React from "react";
import {useHistory, useParams} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import FixIcon from "@material-ui/icons/BugReport";
import {useDispatch} from "react-redux";
import Button from "@material-ui/core/Button";
import Fab from "@material-ui/core/Fab";
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

const stylesCurrent = theme => ({
    tagImage: {
        borderRadius: theme.spacing(2),
        width: "100%"
    },
    follow: {
        borderColor: theme.palette.secondary.main,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: "initial",
        textTransform: "initial",
    },
    _label: {
        [theme.breakpoints.down("sm")]: {
            fontSize: "125%",
            fontWeight: "bold",
            lineHeight: "normal",
            marginBottom: theme.spacing(1),
            marginTop: theme.spacing(1),
        },
    },
    _description: {

    },
    _button: {
        borderColor: theme.palette.secondary.main,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: "initial",
        textTransform: "initial",
        [theme.breakpoints.down("sm")]: {
            width: theme.spacing(10),
            marginLeft: theme.spacing(0.5),
            marginRight: theme.spacing(0.5),
        }
    },
    _profileFields: {
        marginBottom: 0,
    }
});

const Tag = ({classes, allowOwner = true}) => {
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages()
    const [state, setState] = React.useState({disabled: false});
    const {tabSelected = 0, tag} = state;
    const dispatch = useDispatch();
    const db = firebase.database();
    const currentUserData = useCurrentUserData();
    const windowData = useWindowData();
    const {id: itemId} = useParams();

    const isCurrentUserAdmin = matchRole([Role.ADMIN], currentUserData);
    const isOwner = allowOwner && tag && tag.value && tag.value.uid && tag.value.uid === currentUserData.id;

    const buttonProps = (index) => {
        return {
            color: "default",
            variant: "text",
            className: [classes.tabButton, tabSelected === index ? classes.tabButtonSelected : ""].join(" "),
            onClick: () => setState({...state, tabSelected: index})
        }
    }

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
                    child: "_sort_name",
                    equals: itemId,
                    size: 1
                }).next().then(items => items[0])
            })
            .then(tag => {
                if (!tag.value.hidden) history.replace(pages.tag.route + tag.value.id);
                isMounted && setState(state => ({...state, tag}))
            })
            .catch(error => {
                console.error(itemId, error);
                notifySnackbar(Error(`Cannot open "${itemId}" properties`));
                history.goBack();
            })
        // let currentRef = firebase.database().ref("_posts").orderByChild("gid").equalTo(itemId).limitToLast(1);
        // currentRef.on("child_added", handleNewPosts);
        return () => {
            // currentRef && currentRef.off();
            isMounted = false;
        }
        // eslint-disable-next-line
    }, [itemId]);

    if (!tag) return <LoadingComponent/>

    return <>
        <NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            className={classes.top}
            mediumButton={isCurrentUserAdmin && <IconButton
                aria-label={"Fix possible errors"}
                children={<FixIcon/>}
                onClick={fixErrors}
                title={"Fix possible errors"}
            />}
            rightButton={(isCurrentUserAdmin || isOwner) && <IconButton
                aria-label={"Edit"}
                children={<EditIcon/>}
                onClick={() => history.push(pages.edittag.route + tag.key)}
                title={"Edit"}
            />}
        />
        <Grid container className={classes.center}>
            <Grid container>
                {tag.value.image && <Grid item className={classes.profileImageContainer}>
                    <img
                        alt={""}
                        className={[classes.profileImage, classes.tagImage].join(" ")}
                        src={tag.value.image}
                    />
                </Grid>}
                <Grid item className={[classes.profileFields, classes._profileFields].join(" ")}>
                    <Grid container className={classes.profileField}>
                        <Grid item className={classes._label}>
                            {tag.value.label}
                        </Grid>
                    </Grid>
                    <Grid container className={classes.profileField}>
                        <MentionedTextComponent
                            className={classes._description}
                            mentions={[mentionTags, mentionUsers]}
                            text={tag.value.description}
                        />
                    </Grid>
                    <Box m={1}/>
                    <Grid container spacing={1} className={classes.profileField}>
                        <ShareComponent
                            component={<ActionComponent
                                className={classes._button}
                                label={"Invite"}
                            />}
                            text={"Share"}
                            title={"Share"}
                            url={window.location.origin + pages.tag.route + tag.value.id}
                        />
                        <MutualComponent
                            counterComponent={<InfoComponent suffix={"follower(s)"}/>}
                            mutualId={tag.key}
                            mutualType={"tag"}
                            typeId={"watching"}
                            subscribeComponent={<ActionComponent
                                className={classes._button}
                                label={"Follow"}
                            />}
                            unsubscribeComponent={<ActionComponent
                                className={classes._button}
                                label={"Unfollow"}
                            />}
                        />
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
        {/*<NavigationToolbar
            alignItems={"flex-end"}
            justify={"center"}
            backButton={null}
            className={classes.topSticky}
        >
            <Button
                {...buttonProps(0)}
                children={<>
                    Posts
                    <CounterComponent path={`${tag.key}/total`} prefix={" ("} suffix={")"}/>
                </>}/>
        </NavigationToolbar>*/}
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
                        fetchCallable(firebase)("fixMutual", {
                            ...options,
                            id: options.id,
                            tag: tag.key,
                            typeId: "watching"
                        }).then(console.log)
                            .catch(console.error);
                    }
                })}
                noItemsComponent={<PostComponent label={"No posts found"}/>}
                pagination={() => new Pagination({
                    ref: db.ref("_tag").child(tag.key),
                    order: "desc",
                })}
                placeholder={<PostComponent skeleton={true}/>}
            />
        </Grid>
        <NewPostComponent
            buttonComponent={<Fab
                aria-label={"New post"}
                color={"primary"}
                className={classes.fab}
                variant={windowData.isNarrow() ? "round" : "extended"}
            >
                <AddIcon/>
                {!windowData.isNarrow() && "New post"}
            </Fab>}
            context={tag.value.id}
            mentions={[mentionTags, mentionUsers]}
            onBeforePublish={async data => {
                console.log("PUBLISH", data);
                data.text += `${String.fromCharCode(1)}$[tag:${tag.value.id}:${tag.value.label}]${String.fromCharCode(2)}`
                return data;
            }}
            onComplete={key => {
                console.log("COMPLETE", key)
                dispatch({type: lazyListComponentReducer.RESET});
                history.push(pages.post.route + key);
            }}
            onError={error => {
                console.error(error)
            }}
            // text={`$[tag:${tag.value.id}:${tag.value.label}] `}
            UploadProps={windowData.isNarrow() ? {camera: false} : undefined}
        />
        {/*<CounterComponent
            initialValue={random}
            path={`${tag.key}/total`}>
            <Tooltip title={"Refresh posts"}>
                <Fab aria-label={"Refresh"} color={"primary"} className={classes.fabUpper} style={{zIndex: 1}}
                     onClick={() => {
                         setState({...state, random: Math.random()})
                         dispatch({type: lazyListComponentReducer.RESET});
                     }}>
                    <RefreshIcon/>
                </Fab>
            </Tooltip>
        </CounterComponent>*/}
    </>
};

export default withStyles((theme) => ({
    ...styles(theme),
    ...stylesCurrent(theme),
}))(Tag);
