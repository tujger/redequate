import React from "react";
import cardStyles from "./styles/PostComponent.module.css";

export default ({disableClick, handleClickPost, children}) => {
    return disableClick
        ? <>{children}</>
        : <div
            className={cardStyles.wrapper}
            onClick={handleClickPost}
        >
            {children}
        </div>
}
