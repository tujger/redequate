import React from "react";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import StartIcon from "@material-ui/icons/Restore";
import TimeIcon from "@material-ui/icons/Schedule";
import EndIcon from "@material-ui/icons/Update";

// eslint-disable-next-line react/prop-types
export default ({show, range, date, start, end, onClick}) => {
    if (!show) return null;
    return <ButtonGroup variant={"text"} fullWidth>
        {!range && date && <Button
            children={date.format("HH:mm")}
            onClick={date ? () => onClick("date") : null}
            startIcon={<TimeIcon/>}
            title={"Set time"}
            variant={"text"}
        />}
        {range && start && <Button
            children={start.local().format("HH:mm")}
            onClick={start ? () => onClick("start") : null}
            startIcon={<StartIcon/>}
            title={"Set start period time"}
            variant={"text"}
        />}
        {range && start && <Button
            variant={"text"}
            title={"Set end period time"}
            onClick={end ? () => onClick("end") : null}
            startIcon={<EndIcon/>}
            children={end ? end.local().format("HH:mm") : "--:--"}/>
        }
    </ButtonGroup>
};
