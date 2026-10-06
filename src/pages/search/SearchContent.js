import React from "react";
import {useTranslation} from "react-i18next";
import {useHistory} from "react-router-dom";
import baseStyles from "../../themes/Base.module.css";

export default () => {
    const history = useHistory();
    const {t} = useTranslation();

    const args = new URLSearchParams(history.location.search.replace(/^\?/, ""));

    return <div className={baseStyles.content}>
        <div>
            {t("Search.Search value: {{value}}", {value: args.get("q")})}
        </div>
        <div>
            Search is not yet implemented
        </div>
    </div>
}
