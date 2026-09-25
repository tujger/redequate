import React from "react";

export default ({classes, disableClick, handleClickPost, children}) => {
    return disableClick
        ? <>{children}</>
        : <div
            className={classes.wrapper}
            onClick={handleClickPost}
        >
            {children}
        </div>
}
