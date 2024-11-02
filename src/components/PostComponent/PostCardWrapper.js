import React from "react";
import {CardActionArea} from "@mui/material";
import styles from "./styles/PostComponent.module.css";

export default ({disableClick, handleClickPost, children}) => {
    return disableClick
        ? <>{children}</>
        : <CardActionArea
            component={"div"}
            onClick={handleClickPost}
        >
            {children}
        </CardActionArea>
}
