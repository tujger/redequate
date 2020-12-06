import React from "react";
import {withStyles} from "@material-ui/core/styles";
import ItemPlaceholderComponent from "../ItemPlaceholderComponent";
import {stylesList} from "../../controllers/Theme";
import PostCard from "./PostCard";
import RepliesTree from "./RepliesTree";
import {cacheDatas, usePages} from "../../controllers/General";
import {useHistory} from "react-router-dom";
import {lazyListComponentReducer} from "../LazyListComponent/lazyListComponentReducer";
import {useDispatch} from "react-redux";

const PostComponent = ({forceExpand, ...props}) => {
    const {
        skeleton, label, level, postData,
        onChange = data => console.log("onChange", data),
        onDelete = data => console.log("onDelete", data),
        allowedExtras = ["like"],
        collapsible = true,
        disableClick = false,
        expand: givenExpand = [],
        highlight: givenHighlight,
        isReply = false,
        pattern,
        type = "posts",
    } = props;

    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({expand: givenExpand});
    const {highlight, expand} = state;

    const handleChange = (props) => {
        const {key} = props;
        cacheDatas.remove(postData.id);
        if (key) {
            setState(state => ({...state, highlight: key, expand: [...state.expand, postData.id]}))
        } else {
            onChange(props);
        }
    }

    const handleDelete = () => {
        cacheDatas.remove(postData.id);
        if (isReply) {
            dispatch({type: lazyListComponentReducer.REFRESH});
        } else {
            onDelete(postData);
        }
    }

    const handleClickPost = () => {
        history.push(pages.post.route + postData.id)
    }

    const onlyReplies = level === 0 && history && history.location && history.location.state && history.location.state.onlyReplies;

    React.useEffect(() => {
        if (!givenHighlight) return;
        setState(state => ({...state, highlight: givenHighlight}));
    }, [givenHighlight]);

    if (skeleton) return <ItemPlaceholderComponent skeleton pattern={pattern}/>
    if (label) return <ItemPlaceholderComponent label={label} pattern={pattern}/>
    if (!postData) return null;

    const inheritProps = {
        ...props,
        allowedExtras,
        collapsible,
        disableClick,
        expand,
        handleClickPost,
        highlight,
        isReply,
        onChange: handleChange,
        onDelete: handleDelete,
        type,
    }

    return <>
        {!onlyReplies && <PostCard {...inheritProps}/>}
        {level !== undefined && <RepliesTree
            {...inheritProps}
            forceExpand={forceExpand}
            key={highlight}
            postId={postData.id}
        />}
    </>
}

export default withStyles(stylesList)(PostComponent);
