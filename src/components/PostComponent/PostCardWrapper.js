import React from "react";
import CardActionArea from "@material-ui/core/CardActionArea";

export default ({disableClick, handleClickPost, children}) => {
    return disableClick ? <>
        {children}
    </> : <CardActionArea
        component={"div"}
        onClick={handleClickPost}
    >
        {children}
    </CardActionArea>
}
