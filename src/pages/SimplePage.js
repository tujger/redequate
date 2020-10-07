import React from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/styles/withStyles";
import {styles} from "../controllers/Theme";

const SimplePage = ({classes, body = "Content of simple page", title = "Simple page"}) => {
    if (body instanceof Array) {
        body = `<p>${body.join("</p>\n<p>")}</p>`;
    }
    return <div className={classes.center}>
        {title && <h1>{title}</h1>}
        <div dangerouslySetInnerHTML={{__html: body}}/>
    </div>;
};

SimplePage.propTypes = {
    title: PropTypes.string,
    body: PropTypes.any,
};

export default withStyles(styles)(SimplePage);
