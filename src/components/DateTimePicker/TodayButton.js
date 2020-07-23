import React from "react";
import Button from "@material-ui/core/Button";

export const TodayButton = ({show, todayButton = "Now", onClick}) => {
    if (!show) return null;

    return <Button
        children={todayButton}
        fullWidth
        onClick={onClick}
        variant={"text"}
    />
}
