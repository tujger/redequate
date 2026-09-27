import React, {forwardRef} from "react";
import textStyles from "./styles/PostText.module.css";

export default forwardRef((props, ref) => {
    const classes = {...textStyles, ...(props.classes || {})};

    return <div className={[classes.layout, classes.text, classes.ancillaryText].join(" ")} ref={ref}/>
})
