import React from "react";
import StartIcon from "@material-ui/icons/Restore";
import TimeIcon from "@material-ui/icons/Schedule";
import EndIcon from "@material-ui/icons/Update";
import {useTranslation} from "react-i18next";
import Button from "../../controls/Button/Button";
import styles from "./styles/ClockButtons.module.css";

// eslint-disable-next-line react/prop-types
export default ({show, range, date, start, end, onClick}) => {
    const {t} = useTranslation();

    if (!show) return null;
    return <div className={styles.group} role={"group"}>
        {!range && date && <Button
            color={"secondary"}
            fullWidth
            icon={<TimeIcon/>}
            onClick={() => onClick("date")}
            title={t("DateTimePicker.Set time")}
            variant={"text"}
        >
            {date.format("HH:mm")}
        </Button>}
        {range && start && <Button
            color={"secondary"}
            fullWidth
            icon={<StartIcon/>}
            onClick={() => onClick("start")}
            title={t("DateTimePicker.Set start period time")}
            variant={"text"}
        >
            {start.local().format("HH:mm")}
        </Button>}
        {range && start && <Button
            color={"secondary"}
            fullWidth
            icon={<EndIcon/>}
            onClick={end ? () => onClick("end") : undefined}
            tabIndex={end ? 0 : -1}
            title={t("DateTimePicker.Set end period time")}
            variant={"text"}
        >
            {end ? end.local().format("HH:mm") : "--:--"}
        </Button>}
    </div>
};
