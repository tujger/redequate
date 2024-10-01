import React from "react";
import {Button} from "@mui/material";
import {ButtonGroup} from "@mui/material";
import StartIcon from "@mui/icons-material/Restore";
import TimeIcon from "@mui/icons-material/Schedule";
import EndIcon from "@mui/icons-material/Update";
import {useTranslation} from "react-i18next";

// eslint-disable-next-line react/prop-types
export default ({show, range, date, start, end, onClick}) => {
    const {t} = useTranslation();

    if (!show) return null;
    return <ButtonGroup variant={"text"} fullWidth>
        {!range && date && <Button
            children={date.format("HH:mm")}
            onClick={date ? () => onClick("date") : null}
            startIcon={<TimeIcon/>}
            title={t("DateTimePicker.Set time")}
            variant={"text"}
        />}
        {range && start && <Button
            children={start.local().format("HH:mm")}
            onClick={start ? () => onClick("start") : null}
            startIcon={<StartIcon/>}
            title={t("DateTimePicker.Set start period time")}
            variant={"text"}
        />}
        {range && start && <Button
            variant={"text"}
            title={t("DateTimePicker.Set end period time")}
            onClick={end ? () => onClick("end") : null}
            startIcon={<EndIcon/>}
            children={end ? end.local().format("HH:mm") : "--:--"}/>
        }
    </ButtonGroup>
};
