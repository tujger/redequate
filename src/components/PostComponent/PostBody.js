import React from 'react';
import Collapse from "@material-ui/core/Collapse";
import Grid from "@material-ui/core/Grid";
import {useWindowData} from "../../controllers/General";
import MentionedTextComponent from "../MentionedTextComponent";

export default ({classes, collapsible:givenCollapsible, disableClick, mentions, postData}) => {
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
        <Collapse
            addEndListener={() => {
            }}
            in={shortened && collapsed && collapsible}
            timeout={"auto"}
            unmountOnExit
        >
            <MentionedTextComponent
                disableClick={disableClick}
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
                disableClick={disableClick}
                className={classes.text}
                mentions={mentions}
                tokens={postData.tokens}
            />
            {/*{postData.image && <Grid container alignItems={"flex-start"}>*/}
            {/*  <img src={postData.image} alt={"Attachment"} className={classes.cardImage}/>*/}
            {/*</Grid>}*/}
        </Collapse>
    </div>
}

