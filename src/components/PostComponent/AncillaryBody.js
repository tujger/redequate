import React, {forwardRef} from "react";
import Grid from "@material-ui/core/Grid";
export default forwardRef(({classes}, ref) => {
    return <Grid className={[classes.text, "ancillaryText"].join(" ")} ref={ref} container/>
})
