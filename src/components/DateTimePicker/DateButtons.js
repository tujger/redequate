import React from "react";
import {Button, ButtonGroup} from "@material-ui/core";

// eslint-disable-next-line react/prop-types
export const DateButtons = ({classes, date, start, end, onClick}) => {
    if (!date && !start && !end) return null;
    if (date) {
        return <ButtonGroup variant={"text"} fullWidth>
            <Button
                children={date.local().format("L LT")}
                className={classes.sublabel}
            />
        </ButtonGroup>;
    }
    return <ButtonGroup variant={"text"} fullWidth>
        <Button
            children={start ? start.format("L LT") : "-"}
            className={classes.sublabel}
            onClick={() => onClick("start")}
            title={"Select start date"}
        />
        <Button
            children={end ? end.format("L LT") : "-"}
            className={classes.sublabel}
            onClick={() => onClick("end")}
            title={"Select end date"}
        />
    </ButtonGroup>
};
