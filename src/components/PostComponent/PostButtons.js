import React from "react";
import Grid from "@material-ui/core/Grid";
import ActionLike from "./ActionLike";
import ActionDislike from "./ActionDislike";
import ActionReplies from "./ActionReplies";
import ActionReply from "./ActionReply";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useWindowData} from "../../controllers/General";
import ActionTranslate from "./ActionTranslate";

const stylesCurrent = makeStyles(theme => ({
    cardActions: {
        "&$cardActionsSmall": {
            [theme.breakpoints.down("sm")]: {
                marginLeft: theme.spacing(-1),
            }
        },
    },
    cardActionsSmall: {},
}));

export default (props) => {
    const {allowedExtras, ancillaryRef, classes = {}, onChange, showRepliesCounter = true, isReply = false} = props;
    const classesCurrent = stylesCurrent();
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    return <Grid className={[
        classes.cardActions,
        isReply ? classesCurrent.cardActions : "",
        // isReply ? classesCurrent.cardActionsSmall : ""
    ].join(" ")}>
        {!isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
        {allowedExtras.indexOf("like") >= 0 && <ActionLike {...props}/>}
        {allowedExtras.indexOf("dislike") >= 0 && <ActionDislike {...props}/>}
        {(showRepliesCounter && !isReply) && <ActionReplies {...props}/>}
        {isReply && <ActionReply {...props} icon={!isReply || !isNarrow} onComplete={onChange}/>}
        {isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
        {/*{isNarrow && <Grid item xs/>}*/}
        {/*{!isReply && <ButtonShare {...props}/>}*/}
        {/*<ButtonDelete {...props}/>*/}
    </Grid>
}
