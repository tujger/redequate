import React from "react";
import Grid from "@material-ui/core/Grid";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PostComponent from "./PostComponent";
import postItemTransform from "./postItemTransform";
import {useFirebase, useWindowData} from "../../controllers/General";
import {useCurrentUserData, UserData} from "../../controllers/UserData";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";
import AvatarView from "../AvatarView";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {Role} from "../../controllers";

const stylesCurrent = makeStyles(theme => ({
    indent: {
        width: theme.spacing(4)
    },
    textSmall: {
        display: "inline-block",
        fontSize: "90%",
    },
    suggestion: {
        marginBottom: theme.spacing(1),
    },
    suggestionName: {
        color: theme.palette.secondary.main,
        fontWeight: "bold",
    }
}));

export default ({allowedExtras, level, postId, classes = {}, onChange, onDelete, type, UploadProps}) => {
    const firebase = useFirebase();
    const windowData = useWindowData();
    const currentUserData = useCurrentUserData();
    const classesCurrent = stylesCurrent();
    const [state, setState] = React.useState({});
    const {expanded = level !== 1, repliesMin, userReplied} = state;

    const MAX_INDENTING_LEVELS = windowData.isNarrow() ? 2 : 10;

    React.useEffect(async () => {
        const pagination = new Pagination({
            ref: firebase.database().ref(type),
            child: "to",
            equals: postId,
            order: "desc",
        });
        const items = await pagination.next();
        if (items[0]) {
            UserData(firebase).fetch(items[0].value.uid, [UserData.NAME, UserData.IMAGE])
                .then(userData => {
                    setState(state => ({...state, pagination, repliesMin: items.length, userReplied: userData}));
                })
        }
    }, []);

    if (!repliesMin) return null;
    if (!expanded) return <Grid container>
        <Grid className={classesCurrent.indent}/>
        <Grid item xs className={classesCurrent.suggestion}>
            <ItemPlaceholderComponent
                avatar={<AvatarView className={classes.avatarSmall} image={userReplied.image} initials={userReplied.initials} verified/>}
                label={<span className={classesCurrent.textSmall}>
                    <span className={classesCurrent.suggestionName}>{userReplied.name}</span>{repliesMin > 1 ? " and others replied" : " replied"}
                </span>}
                transparent
                onClick={() => {
                    setState(state => ({...state, expanded: true}));
                }}
            />
        </Grid>
    </Grid>

    return <Grid container>
        {level > 0 && level < MAX_INDENTING_LEVELS && <Grid className={classesCurrent.indent}/>}
        <Grid item xs>
            <LazyListComponent
                disableProgress={true}
                pagination={() => new Pagination({
                    ref: firebase.database().ref(type),
                    child: "to",
                    equals: postId,
                    order: "desc"
                })}
                itemTransform={postItemTransform({firebase, currentUserData, type, allowedExtras})}
                itemComponent={item => <PostComponent
                    allowedExtras={allowedExtras}
                    classes={{
                        ...classes,
                        avatar: classes.avatarSmall,
                        cardActions: [classes.cardActions, classes.cardActionsSmall].join(" "),
                    }}
                    collapsible={false}
                    disableClick
                    cloud
                    isReply={true}
                    key={item.id}
                    level={expanded ? level + 1 : undefined}
                    onChange={onChange}
                    postData={item}
                    showRepliesCounter={false}
                    userData={item._userData}
                    UploadProps={UploadProps}
                />}
                placeholder={<PostComponent skeleton={true} cloud/>}
            />
        </Grid>
    </Grid>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
