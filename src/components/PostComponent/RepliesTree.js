import React from "react";
import Grid from "@material-ui/core/Grid";
import PostComponent from "./PostComponent";
import postItemTransform from "./postItemTransform";
import {useFirebase, useMetaInfo, usePages, useWindowData} from "../../controllers/General";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {useHistory} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";
import {notifySnackbar} from "../../controllers";
import RotatingReplies from "./RotatingReplies";

const stylesCurrent = theme => ({
    indent: {},
    sectionComment: {
        "& $indent": {
            [theme.breakpoints.up("md")]: {
                width: theme.spacing(8.5)
            },
            [theme.breakpoints.down("sm")]: {
                width: theme.spacing(6.5)
            },
        }
    },
    sectionReply: {
        "& $indent": {
            [theme.breakpoints.up("md")]: {
                width: theme.spacing(4)
            },
            [theme.breakpoints.down("sm")]: {},
        }
    },
    textSmall: {
        display: "inline-block",
        fontSize: "90%",
    },
    suggestionName: {
        color: theme.palette.secondary.main,
        fontWeight: "bold",
    }
});

export default withStyles(stylesCurrent)((props) => {
    const {allowedExtras, level, postId, classes = {}, type, expand, onChange, expanded: givenExpanded} = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({});
    const {expanded, replies, userReplied, paginationOptions, rotating} = state;
    const metaInfo = useMetaInfo();
    const {settings = {}} = metaInfo || {};
    const {postsRotateReplies} = settings;

    const MAX_INDENTING_LEVELS = windowData.isNarrow() ? 2 : 10;

    React.useEffect(() => {
        let isMounted = true;
        const paginationOptions = {
            ref: firebase.database().ref(type),
            equals: postId,
            child: "to",
            order: "desc",
        };

        const prepareChecking = async () => {
            // throw {expanded: true, a:0};
        }
        const throwIfPostOnIndex = async () => {
            if (level === undefined) {
                return fetchExistingRepliesIfComment()
                    .then(replies => {
                        throw {expanded: false, rotating: true, replies};
                    })
            }
        }
        const throwExpandIfGivenExpanded = async () => {
            if (givenExpanded) throw {expanded: true, a: 1};
        }
        const throwExpandIfForceExpanded = async () => {
            if (expand && level === 0) {
                throw {
                    expanded: true,
                    paginationOptions: {
                        ref: firebase.database().ref(type),
                        equals: expand,
                    },
                    a: 2
                };
            }
            if (level > 0 && expand) throw {expanded: true, a: 3};
        }
        const throwExpandIfReply = async () => {
            if (level > 1) throw {expanded: true, a: 4};
        }
        const throwExpandIfShowingPost = async () => {
            if (level === 0) throw {expanded: true, a: 5};
        }
        const fetchExistingRepliesIfComment = async () => {
            const pagination = new Pagination(paginationOptions);
            return pagination.next();
        }
        const fetchFirstAuthorOfReplies = async replies => {
            if (replies[0]) {
                return UserData(firebase)
                    .fetch(replies[0].value.uid, [UserData.NAME, UserData.IMAGE])
                    .then(userReplied => {
                        throw {replies, userReplied};
                    })
            }
            throw {expanded: false, a: 6};
        }
        const throwInfoToExpand = async ({replies, userReplied}) => {
            throw {replies, userReplied};
        }
        const updateState = async props => {
            // console.error(postId, {paginationOptions, ...props})
            if (props instanceof Error) throw props;
            isMounted && setState(state => ({...state, paginationOptions, ...props}))
        }
        const finalizeChecking = async () => {
        }

        prepareChecking()
            .then(throwExpandIfGivenExpanded)
            .then(throwIfPostOnIndex)
            .then(throwExpandIfForceExpanded)
            .then(throwExpandIfReply)
            .then(throwExpandIfShowingPost)
            .then(fetchExistingRepliesIfComment)
            .then(fetchFirstAuthorOfReplies)
            // .then(throwInfoToExpand)
            .catch(updateState)
            .catch(notifySnackbar)
            .finally(finalizeChecking)

        return () => {
            isMounted = false;
        }
    }, [givenExpanded]);

    if (!paginationOptions) return null;
    if (postsRotateReplies === "outside" && rotating && replies && replies.length) {
        return <Grid container>
            <Grid className={classes.indent}/>
            <Grid item xs>
                <RotatingReplies {...props} items={replies}/>
            </Grid>
        </Grid>
    }

    if (!expanded && !userReplied) return null;
    if (!expanded) {
        return <Grid container>
            <Grid className={classes.indent}/>
            <Grid item xs>
                <ItemPlaceholderComponent
                    avatar={<AvatarView
                        className={classes.avatarSmallest}
                        image={userReplied.image}
                        initials={userReplied.initials}
                        verified
                    />}
                    label={<span className={classes.textSmall}>
                        <span className={classes.suggestionName}>
                            {userReplied.name}
                        </span>
                        {replies && replies.length > 1 ? " and others replied" : " replied"}
                    </span>}
                    pattern={"transparent"}
                    onClick={() => {
                        setState(state => ({...state, expanded: true}));
                    }}
                />
            </Grid>
        </Grid>
    }

    return <>
        {expand && level === 0 && <Grid container>
            <Grid item xs>
                <ItemPlaceholderComponent
                    avatar={null}
                    label={<span className={classes.textSmall}>
                        Click here to see the entire thread.
                    </span>}
                    pattern={"flat"}
                    onClick={() => history.push(pages.post.route + postId)}
                />
            </Grid>
        </Grid>}
        <Grid container className={level > 1 ? classes.sectionReply : classes.sectionComment}>
            {level > 0 && level < MAX_INDENTING_LEVELS && <Grid className={classes.indent}/>}
            <Grid item xs>
                <LazyListComponent
                    disableProgress={true}
                    pagination={() => new Pagination(paginationOptions)}
                    itemTransform={postItemTransform({
                        allowedExtras,
                        currentUserData,
                        firebase,
                        type,
                    })}
                    itemComponent={item => <PostComponent
                        {...props}
                        classes={{
                            ...classes,
                            cardActions: [classes.cardActions, classes.cardActionsSmall].join(" "),
                        }}
                        collapsible={false}
                        disableClick
                        isReply={true}
                        key={item.id}
                        level={expanded ? level + 1 : undefined}
                        onChange={onChange}
                        pattern={"cloud"}
                        postData={item}
                        showRepliesCounter={false}
                        userData={item._userData}
                    />}
                    placeholder={<PostComponent avatar={null} skeleton={true} pattern={"cloud"}/>}
                />
            </Grid>
        </Grid>
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
})
