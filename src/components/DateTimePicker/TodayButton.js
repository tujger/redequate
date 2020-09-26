import React from "react";
import Button from "@material-ui/core/Button";

// eslint-disable-next-line react/prop-types
export default ({show, todayButton = "Now", onClick}) => {
    if (!show) return null;

    return <Button
        children={todayButton}
        fullWidth
        onClick={onClick}
        variant={"text"}
    />
}
