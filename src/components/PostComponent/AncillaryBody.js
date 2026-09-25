import React, {forwardRef} from "react";

export default forwardRef((props, ref) => {
    const {classes} = props;

    return <div className={[classes.layout, classes.text, classes.ancillaryText].join(" ")} ref={ref}/>
})
