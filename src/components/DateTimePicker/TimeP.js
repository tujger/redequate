import React from "react";
import {Button} from "@mui/material";
import TimeKeeper from "react-timekeeper";

// eslint-disable-next-line react/prop-types
export default ({classes, time, onSelect, style}) => <React.Fragment>
    <TimeKeeper
        className={[classes._clock, classes.clock].join(" ")}
        closeOnMinuteSelect
        doneButton={() => <Button style={{display: "none"}} children={""}/>}
        hour24Mode={false}
        onDoneClick={onSelect}
        time={time ? {hour: time.hours(), minute: time.minutes()} : null}
        switchToMinuteOnHourSelect
    />
    <style>{style}</style>
</React.Fragment>
