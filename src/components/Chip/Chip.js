import React from "react";
import MaterialChip from "@material-ui/core/Chip";
import chipStyles from "./Chip.module.css";

// eslint-disable-next-line react/prop-types
const Chip = ({className, ...props}) => <MaterialChip
    {...props}
    className={[chipStyles.chip, className].filter(Boolean).join(" ")}
/>;

export default Chip;
