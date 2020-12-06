import React from "react";
import Grid from "@material-ui/core/Grid";
import PostComponent from "./PostComponent";
import postItemTransform from "./postItemTransform";
import {useFirebase, usePages, useWindowData} from "../../controllers/General";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {useHistory} from "react-router-dom";
import withStyles from "@material-ui/styles/withStyles";

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
            [theme.breakpoints.down("sm")]: {
            },
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

export default withStyles(stylesCurrent)(({forceExpand, ...props}) => {
    const {allowedExtras, level, postId, classes = {}, type, expand: givenExpand, onChange} = props;
    const currentUserData = useCurrentUserData();
    const firebase = useFirebase();
    const history = useHistory();
    const pages = usePages();
    const windowData = useWindowData();
    const [state, setState] = React.useState({expand: []});
    const {expanded, repliesMin, userReplied, expand, paginationOptions} = state;

    const MAX_INDENTING_LEVELS = windowData.isNarrow() ? 2 : 10;

    React.useEffect(async () => {
        let isMounted = true;
        const paginationOptions = (forceExpand && forceExpand !== postId) ? {
            equals: forceExpand,
        } : {
            child: "to",
            equals: postId,
        }

        const pagination = new Pagination({
            ref: firebase.database().ref(type),
            order: "desc",
            ...paginationOptions,
        });
        const items = await pagination.next();
        if (items[0]) {
            UserData(firebase).fetch(items[0].value.uid, [UserData.NAME, UserData.IMAGE])
                .then(userData => {
                    isMounted && setState(state => ({
                        ...state,
                        paginationOptions,
                        repliesMin: items.length,
                        userReplied: userData
                    }));
                })
        }
        return () => {
            isMounted = false;
        }
    }, []);

    React.useEffect(() => {
        if (!expand) return;
        let isMounted = true;
        const exp = [...(expand || []), ...(givenExpand || [])];
        const expanded = level !== 1 || exp.indexOf(postId) >= 0;
        isMounted && setState(state => ({...state, expanded}))
        return () => {
            isMounted = false;
        }
    }, [expand, givenExpand])

    if (!repliesMin) return null;
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
                        {repliesMin > 1 ? " and others replied" : " replied"}
                    </span>}
                    pattern={"transparent"}
                    onClick={() => {
                        setState(state => ({...state, expand: [...state.expand, postId]}));
                    }}
                />
            </Grid>
        </Grid>
    }

    return <>
        {forceExpand && <Grid container>
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
                    pagination={() => new Pagination({
                        ref: firebase.database().ref(type),
                        order: "desc",
                        ...paginationOptions
                    })}
                    itemTransform={postItemTransform({firebase, currentUserData, type, allowedExtras})}
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
