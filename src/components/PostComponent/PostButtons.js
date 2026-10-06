import React from "react";
import ActionLike from "./ActionLike";
import ActionDislike from "./ActionDislike";
import ActionReplies from "./ActionReplies";
import ActionReply from "./ActionReply";
import {useWindowData} from "../../controllers/General";
import ActionTranslate from "./ActionTranslate";
import cardStyles from "./styles/PostComponent.module.css";

export default (props) => {
    const {allowedExtras, ancillaryRef, onChange, showRepliesCounter = true, isReply = false} = props;
    const windowData = useWindowData();

    const isNarrow = windowData.isNarrow();

    return <div className={[
        cardStyles.layout,
        cardStyles.cardActions,
        isReply && cardStyles.cardActionsSmall,
    ].filter(Boolean).join(" ")}>
        {!isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
        {allowedExtras.indexOf("like") >= 0 && <ActionLike {...props}/>}
        {allowedExtras.indexOf("dislike") >= 0 && <ActionDislike {...props}/>}
        {(showRepliesCounter && !isReply) && <ActionReplies {...props}/>}
        {isReply && <ActionReply {...props} icon={!isReply || !isNarrow} onComplete={onChange}/>}
        {isNarrow && <ActionTranslate {...props} ancillaryRef={ancillaryRef}/>}
    </div>
}
