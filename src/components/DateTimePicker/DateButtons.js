import React from "react";
import {useTranslation} from "react-i18next";
import Button from "../../controls/Button/Button";
import styles from "./styles/DateButtons.module.css";

export default ({date, start, end, onClick}) => {
    const {t} = useTranslation();

    if (!date && !start && !end) return null;

    return <div className={styles.group} role={"group"}>
        {date
            ? <Button
                className={[styles.button, styles.sublabel].join(" ")}
                title={t("DateTimePicker.Select start date")}
                variant={"text"}
            >
                {date.local().format("L LT")}
            </Button>
            : <>
                <Button
                    className={styles.button}
                    onClick={() => onClick("start")}
                    title={t("DateTimePicker.Select start date")}
                    variant={"text"}
                >
                    {start ? start.format("L LT") : "-"}
                </Button>
                <Button
                    className={styles.button}
                    onClick={() => onClick("end")}
                    title={t("DateTimePicker.Select end date")}
                    variant={"text"}
                >
                    {end ? end.format("L LT") : "-"}
                </Button>
            </>}
    </div>
};
