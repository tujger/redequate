import React from "react";
import {useWindowData} from "../../controllers/General";
import MentionedTextComponent from "../MentionedTextComponent";
import AncillaryBody from "./AncillaryBody";
import cardStyles from "./styles/PostComponent.module.css";
import textStyles from "./styles/PostText.module.css";

export default React.forwardRef(({collapsible: givenCollapsible, disableClick, mentions, postData}, ref) => {
    const [state, setState] = React.useState({});
    const {
        collapsible = givenCollapsible,
        collapsed = givenCollapsible,
    } = state;
    const windowData = useWindowData();

    const handleClickCard = evt => {
        evt && evt.stopPropagation();
        setState(state => ({...state, collapsed: !collapsed}));
    }

    const collapseLength = windowData.isNarrow() ? 260 : 2000;
    const shortened = postData.length > collapseLength;

    return <div className={cardStyles.cardBody}>
        {shortened && collapsed && collapsible && <div className={cardStyles.collapse}>
            <MentionedTextComponent
                disableClick={disableClick}
                mentions={mentions}
                tokens={postData.tokensByLength(collapseLength)}
            />
            <div
                className={[cardStyles.layout, textStyles.showMore].join(" ")}
                onClick={handleClickCard}
            >
                Show more
            </div>
        </div>}
        {(!shortened || !collapsed || !collapsible) && <div
            className={cardStyles.collapse}
            onClick={(shortened && !collapsed) ? handleClickCard : null}
        >
            <MentionedTextComponent
                disableClick={disableClick}
                className={textStyles.text}
                mentions={mentions}
                tokens={postData.tokens}
            />
        </div>}
        <AncillaryBody ref={ref}/>
    </div>
})
