import React from "react";
import Button from "@material-ui/core/Button";
import TimeKeeper from "react-timekeeper";

export const TimeP = ({classes, time, onSelect, style}) => <div>
    <TimeKeeper
        className={classes.clock}
        closeOnMinuteSelect
        doneButton={() => <Button style={{display: "none"}} children={""}/>}
        hour24Mode={false}
        onDoneClick={onSelect}
        time={time ? {hour: time.hours(), minute: time.minutes()} : null}
        switchToMinuteOnHourSelect
    />
    <style>{style}</style>
</div>
