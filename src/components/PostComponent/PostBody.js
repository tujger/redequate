import React from "react";
import {useWindowData} from "../../controllers/General";
import MentionedTextComponent from "../MentionedTextComponent";
import AncillaryBody from "./AncillaryBody";

export default React.forwardRef(({classes, collapsible: givenCollapsible, disableClick, mentions, postData}, ref) => {
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

    return <div className={classes.cardBody}>
        {shortened && collapsed && collapsible && <div className={[classes.collapse, classes.collapseOpen].join(" ")}>
            <MentionedTextComponent
                disableClick={disableClick}
                mentions={mentions}
                tokens={postData.tokensByLength(collapseLength)}
            />
            <div
                className={[classes.layout, classes.showMore].join(" ")}
                onClick={handleClickCard}
            >
                Show more
            </div>
        </div>}
        {(!shortened || !collapsed || !collapsible) && <div
            className={[classes.collapse, classes.collapseOpen].join(" ")}
            onClick={(shortened && !collapsed) ? handleClickCard : null}
        >
            <MentionedTextComponent
                disableClick={disableClick}
                className={classes.text}
                mentions={mentions}
                tokens={postData.tokens}
            />
        </div>}
        <AncillaryBody classes={classes} ref={ref}/>
    </div>
})
