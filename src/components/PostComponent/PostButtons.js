import React from "react";
import ActionLike from "./ActionLike";
import ActionDislike from "./ActionDislike";
import ActionReplies from "./ActionReplies";
import ActionReply from "./ActionReply";
import {useWindowData} from "../../controllers/General";
import ActionTranslate from "./ActionTranslate";

export default (props) => {
    const {allowedExtras, ancillaryRef, classes = {}, onChange, showRepliesCounter = true, isReply = false} = props;
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    return <div className={[classes.layout, [
        classes.cardActions,
        isReply ? classes.cardActionsSmall : "",
        // isReply ? classesCurrent.cardActionsSmall : ""
    ].join(" ")].join(" ")}>
        {!isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
        {allowedExtras.indexOf("like") >= 0 && <ActionLike {...props}/>}
        {allowedExtras.indexOf("dislike") >= 0 && <ActionDislike {...props}/>}
        {(showRepliesCounter && !isReply) && <ActionReplies {...props}/>}
        {isReply && <ActionReply {...props} icon={!isReply || !isNarrow} onComplete={onChange}/>}
        {isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
    </div>
}
