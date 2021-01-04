import React from "react";
import {useTranslation} from "react-i18next";

const NotFound = () => {
    const {t} = useTranslation();

    return <div title={t("NotFound.Not found")}>
        <h1 dangerouslySetInnerHTML={{
            __html: t("NotFound.No match for {{location}}", {
                location: `<code>${window.location.pathname}</code>`,
                interpolation: {escapeValue: false}
            })
        }}/>
    </div>;
}

export default NotFound;
