import React from "react";
import ActionLike from "./ActionLike";
import ActionDislike from "./ActionDislike";
import ActionReplies from "./ActionReplies";
import ActionReply from "./ActionReply";
import {useWindowData} from "../../controllers/General";
import ActionTranslate from "./ActionTranslate";
import actionStyles from "./styles/PostActions.module.css";
import cardStyles from "./styles/PostComponent.module.css";

export default (props) => {
    const {allowedExtras, ancillaryRef, classes = {}, onChange, showRepliesCounter = true, isReply = false} = props;
    const componentClasses = {...cardStyles, ...actionStyles, ...classes};
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    return <div className={[componentClasses.layout, [
        componentClasses.cardActions,
        isReply ? componentClasses.cardActionsSmall : "",
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
