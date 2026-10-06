import React, {forwardRef} from "react";
import cardStyles from "./styles/PostComponent.module.css";
import textStyles from "./styles/PostText.module.css";

export default forwardRef((props, ref) => {
    return <div className={[
        cardStyles.layout,
        textStyles.text,
        textStyles.ancillaryText,
    ].join(" ")} ref={ref}/>
})
