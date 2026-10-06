import React from "react";
import {useTranslation} from "react-i18next";
import {useMetaInfo} from "../controllers/General";
import styles from "./styles/SystemAlert.module.css";

export default ({message}) => {
    const metaInfo = useMetaInfo();
    const {maintenance} = metaInfo || {};
    const {t} = useTranslation();

    if (!maintenance && !message) return null;
    const {
        message: maintenanceMessage = t("MetaInfo.Sorry, the service is temporarily unavailable."),
        person = {},
        timestamp
    } = maintenance || {};
    const {name, email} = person;
    return <>
        <div className={styles.root}>
            <h4>{message || maintenanceMessage}</h4>
            {timestamp && <>
                <div className={styles.caption}>
                    <div dangerouslySetInnerHTML={{
                        __html: t("MetaInfo.Maintenance has been established by {{person}} at {{date}}", {
                            person: `<a href='mailto:${email}' style='color:inherit'>${name}</a>`,
                            date: new Date(timestamp).toLocaleString(),
                            nsSeparator: "~",
                            interpolation: {escapeValue: false}
                        })
                    }}/>
                </div>
                <div className={styles.spacer}/>
            </>}
        </div>
    </>
};
