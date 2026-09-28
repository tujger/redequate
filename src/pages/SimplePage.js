import React from "react";
import PropTypes from "prop-types";
import baseStyles from "../themes/Base.module.css";

const SimplePage = ({body = "Content of simple page", title = "Simple page"}) => {
    if (body instanceof Array) {
        body = `<p>${body.join("</p>\n<p>")}</p>`;
    }
    return <div className={baseStyles.content}>
        {title && <h1>{title}</h1>}
        <div dangerouslySetInnerHTML={{__html: body}}/>
    </div>;
};

SimplePage.propTypes = {
    title: PropTypes.string,
    body: PropTypes.any,
};

export default SimplePage;
