import React from "react";
import {Collapse} from "@mui/material";
import {Grid} from "@mui/material";
import {useWindowData} from "../../controllers/General";
import MentionedTextComponent from "../MentionedTextComponent";
import AncillaryBody from "./AncillaryBody";
import styles from "./styles/PostComponent.module.css";

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

    return <div className={styles.body}>
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
                className={styles.showMore}
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
                mentions={mentions}
                tokens={postData.tokens}
            />
            {/*{postData.image && <Grid container alignItems={"flex-start"}>*/}
            {/*  <img src={postData.image} alt={"Attachment"} className={classes.cardImage}/>*/}
            {/*</Grid>}*/}
        </Collapse>
        <AncillaryBody ref={ref}/>
    </div>
})
