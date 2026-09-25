import React from "react";
import CardActionArea from "@material-ui/core/CardActionArea";

export default ({classes, disableClick, handleClickPost, children}) => {
    return disableClick
        ? <>{children}</>
        : <CardActionArea
            className={classes.wrapper}
            component={"div"}
            onClick={handleClickPost}
        >
            {children}
        </CardActionArea>
}
