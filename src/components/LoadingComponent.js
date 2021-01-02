import React from "react";
import {getI18n} from "react-i18next";

function LoadingComponent(props) {
    // const {t} = useTranslation();

    const t = (getI18n() && getI18n().getFixedT(null)) || (resource => resource.replace(/^\w+\.]/, ""));

    const {text = t("Loading ...")} = props;
    return <div className={"progress-loading"}>
        {text}
        <svg className={"progress-circular"}>
            <circle
                className={"progress-path"}
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

export default LoadingComponent;
