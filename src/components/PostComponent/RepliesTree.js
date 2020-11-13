import React from "react";
import Grid from "@material-ui/core/Grid";
import makeStyles from "@material-ui/core/styles/makeStyles";
import PostComponent from "./PostComponent";
import postItemTransform from "./postItemTransform";
import {useFirebase, useWindowData} from "../../controllers/General";
import {useCurrentUserData} from "../../controllers/UserData";
import LazyListComponent from "../LazyListComponent/LazyListComponent";
import Pagination from "../../controllers/FirebasePagination";

const stylesCurrent = makeStyles(theme => ({
    indent: {
        width: theme.spacing(4)
    },
}));

export default ({allowedExtras, level, postId, classes = {}, onChange, onDelete, type, UploadProps}) => {
    const firebase = useFirebase();
    const windowData = useWindowData();
    const currentUserData = useCurrentUserData();
    const classesCurrent = stylesCurrent();

    const MAX_INDENTING_LEVELS = windowData.isNarrow() ? 2 : 10;

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
                        cardActions: classes.cardActionsSmall,
                    }}
                    collapsible={false}
                    disableClick
                    isReply={true}
                    key={item.id}
                    level={level + 1}
                    onChange={onChange}
                    postData={item}
                    showRepliesCounter={false}
                    userData={item._userData}
                    UploadProps={UploadProps}
                />}
                placeholder={<PostComponent skeleton={true}/>}
            />
        </Grid>
    </Grid>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
