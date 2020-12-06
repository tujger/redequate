import React from "react";
import Grid from "@material-ui/core/Grid";
import ButtonLike from "./ButtonLike";
import ButtonDislike from "./ButtonDislike";
import ButtonReplies from "./ButtonReplies";
import ButtonReply from "./ButtonReply";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {useWindowData} from "../../controllers/General";

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
    const {allowedExtras, classes = {}, showRepliesCounter = true, isReply = false} = props;
    const classesCurrent = stylesCurrent();
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    return <Grid className={[
        classes.cardActions,
        isReply ? classesCurrent.cardActions : "",
        // isReply ? classesCurrent.cardActionsSmall : ""
    ].join(" ")}>
        {allowedExtras.indexOf("like") >= 0 && <ButtonLike {...props}/>}
        {allowedExtras.indexOf("dislike") >= 0 && <ButtonDislike {...props}/>}
        {(showRepliesCounter && !isReply) && <ButtonReplies {...props}/>}
        {isReply && <ButtonReply {...props} icon={!isReply || !isNarrow}/>}
        {/*{isNarrow && <Grid item xs/>}*/}
        {/*{!isReply && <ButtonShare {...props}/>}*/}
        {/*<ButtonDelete {...props}/>*/}
    </Grid>
}
