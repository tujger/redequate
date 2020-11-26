import React from "react";
import {withStyles} from "@material-ui/core/styles";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {stylesList} from "../../controllers/Theme";
import PostCard from "./PostCard";

const PostComponent = (props) => {
    const {cloud, skeleton, label, flat, transparent} = props;

    if (skeleton) return <ItemPlaceholderComponent skeleton flat={flat} cloud={cloud} transparent={transparent}/>
    if (label) return <ItemPlaceholderComponent label={label} flat={flat} cloud={cloud} transparent={transparent}/>
    if (!props.postData) return null;
    return <PostCard {...props}/>
}

export default withStyles(stylesList)(PostComponent);
