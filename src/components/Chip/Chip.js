import MaterialChip from "@material-ui/core/Chip";
import React from "react";
import chipStyles from "./Chip.module.css";

export default ({className, ...props}) => {
    return <MaterialChip
        {...props}
        className={[chipStyles.chip, className].filter(Boolean).join(" ")}
    />;
}
