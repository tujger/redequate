import React from "react";
import IconButton from "@material-ui/core/IconButton";
import ShareIcon from "@material-ui/icons/Share";
import Grid from "@material-ui/core/Grid";
import {usePages} from "../../controllers/General";
import ShareComponent from "../ShareComponent";

export default ({postData}) => {
    const pages = usePages();

    return <Grid item>
        <ShareComponent
            component={<IconButton
                aria-label={"Share"}
                children={<ShareIcon/>}
                component={"div"}
                size={"small"}
                title={"Share"}
            />}
            text={"Share"}
            title={"Share"}
            url={window.location.origin + pages.post.route + postData.id}
        />
    </Grid>
}
