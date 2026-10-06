import React from "react";
import baseStyles from "../themes/Base.module.css";
import styles from "./styles/SimplePage.module.css";

export default ({body = undefined, children = undefined, title = undefined}) => {
    if (!body && !children) {
        throw new Error("Either body or children must be provided");
    }
    if (body instanceof Array) {
        body = `<p>${body.join("</p>\n<p>")}</p>`;
    }
    return <div className={[baseStyles.content, styles.content].join(" ")}>
        {title && <h1>{title}</h1>}
        {body && <div dangerouslySetInnerHTML={{__html: body}}/>}
        {children}
    </div>;
};
