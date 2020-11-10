import React from 'react';
import Collapse from "@material-ui/core/Collapse";
import Grid from "@material-ui/core/Grid";
import {useWindowData} from "../../controllers/General";
import MentionedTextComponent from "../MentionedTextComponent";

export default ({classes, collapsible:givenCollapsible, mentions, postData}) => {
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

    const collapseLength = windowData.isNarrow() ? 1000 : 2000;
    const shortened = postData.length > collapseLength;

    return <>
        <Collapse
            addEndListener={() => {
            }}
            in={shortened && collapsed && collapsible}
            timeout={"auto"}
            unmountOnExit
        >
            <MentionedTextComponent
                mentions={mentions}
                tokens={postData.tokensByLength(collapseLength)}
            />
            <Grid
                container
                className={classes.showMore}
                onClick={handleClickCard}
            >
                Show more
            </Grid>
        </Collapse>
        <Collapse
            addEndListener={() => {
            }}
            in={!shortened || !collapsed || !collapsible}
            onClick={(shortened && !collapsed) ? handleClickCard : null}
            timeout={"auto"}
            unmountOnExit
        >
            <MentionedTextComponent
                className={classes.text}
                mentions={mentions}
                tokens={postData.tokens}
            />
            {postData.image && <Grid container alignItems={"flex-start"}>
                <img src={postData.image} alt={"Attachment"} className={classes.cardImage}/>
            </Grid>}
        </Collapse>
    </>
}

