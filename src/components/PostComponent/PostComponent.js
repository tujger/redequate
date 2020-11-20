import React from "react";
import {withStyles} from "@material-ui/core/styles";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {stylesList} from "../../controllers/Theme";
import PostCard from "./PostCard";

const PostComponent = (props) => {
    const {skeleton, label} = props;

    if (skeleton) return <ItemPlaceholderComponent skeleton/>
    if (label) return <ItemPlaceholderComponent label={label}/>
    if (!props.postData) return null;
    return <PostCard {...props}/>
}

export default withStyles(stylesList)(PostComponent);
