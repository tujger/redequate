import React from "react";
import {getI18n} from "react-i18next";
import classes from "./styles/LoadingComponent.module.css";

export default (props) => {
    const t = (getI18n() && getI18n().getFixedT(null)) || (resource => resource.replace(/^\w+\.]/, ""));

    const {text = t("Loading ...")} = props;
    return <div className={classes.loading}>
        {text}
        <svg className={classes.circular} viewBox={"0 0 80 80"}>
            <circle
                className={classes.path}
                cx={"40"}
                cy={"40"}
                fill={"none"}
                r={"20"}
                strokeWidth={"2"}
                strokeMiterlimit={"10"}
            />
        </svg>
    </div>;
}
