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
import {notifySnackbar} from "../../controllers";

const PostComponent = (props) => {
    const {
        skeleton, label, level, postData,
        onChange = data => console.log("onChange", data),
        onDelete = data => console.log("onDelete", data),
        allowedExtras = ["like"],
        collapsible = true,
        disableClick = false,
        expand: givenExpand,
        expanded: givenExpanded,
        highlight: givenHighlight,
        isReply = false,
        pattern,
        type = "posts",
    } = props;

    const dispatch = useDispatch();
    const history = useHistory();
    const pages = usePages();
    const [state, setState] = React.useState({expand: givenExpand});
    const {highlight, expand, random} = state;

    const handleChange = (props) => {
        const {key} = props;
        cacheDatas.remove(postData.id);
        if (key === postData.id) {
            postData.fetch(true)
                .then(() => setState(state => ({...state, random: Math.random()})))
                .catch(notifySnackbar)
        } else if (key) {
            setState(state => ({...state, highlight: key, expand: postData.id}))
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
    const expanded = givenExpanded || onlyReplies;

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
        expanded,
        handleClickPost,
        highlight,
        isReply,
        onChange: handleChange,
        onDelete: handleDelete,
        type,
    }

    return <>
        {!onlyReplies && <PostCard key={random} {...inheritProps}/>}
        <RepliesTree
            {...inheritProps}
            key={highlight}
            postId={postData.id}
        />
    </>
}

export default withStyles(stylesList)(PostComponent);
