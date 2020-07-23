import React from "react";
import {Button, ButtonGroup} from "@material-ui/core";
import {Restore as StartIcon, Schedule as TimeIcon, Update as EndIcon,} from "@material-ui/icons";

export const ClockButtons = ({show, range, date, start, end, onClick}) => {
    if (!show) return null;
    return <ButtonGroup variant="text" fullWidth>
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
