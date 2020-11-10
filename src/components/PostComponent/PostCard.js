import React from "react";
import {Link, useHistory} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import CardActionArea from "@material-ui/core/CardActionArea";
import RepliesTree from "./RepliesTree";
import PostButtons from "./PostButtons";
import PostBody from "./PostBody";
import {cacheDatas, usePages} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";

export default (
    {
        allowedExtras = ["like"],
        classes = {},
        className,
        collapsible = true,
        disableClick,
        disableButtons,
        isReply = false,
        level,
        mentions,
        onChange = postData => console.log("onChange", postData),
        onDelete = postData => console.log("onDelete", postData),
        postData,
        showRepliesCounter = true,
        type = "posts",
        userData,
    }) => {
    const history = useHistory();
    const pages = usePages();

    const handleChange = () => {
        cacheDatas.remove(postData.id);
        onChange(postData);
    }

    const handleDelete = () => {
        cacheDatas.remove(postData.id);
        onDelete(postData);
    }

    const handleClickPost = () => {
        history.push(pages.post.route + postData.id)
    }

    const Wrapper = disableClick ? <></> : <CardActionArea
        component={"div"}
        onClick={handleClickPost}
    />

    // return React.useMemo(() => {
    return <>
        <Card className={[classes.root, classes.card, className].join(" ")}>
            <Wrapper.type {...Wrapper.props}>
                <CardHeader
                    classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={<Link className={classes.avatar} to={pages.user.route + postData.uid}>
                        <AvatarView
                            className={classes.avatar}
                            image={userData.image}
                            initials={userData.initials}
                            verified={true}
                        />
                    </Link>}
                    title={<Grid container>
                        <Grid item className={classes.userName}>
                            <Link
                                to={pages.user.route + userData.id}
                                className={[classes.label].join(" ")}
                            >{userData.name}</Link>
                        </Grid>
                        <Grid item className={classes.date} title={new Date(postData.created).toLocaleString()}>
                            {toDateString(postData.created)}
                        </Grid>
                    </Grid>}
                    subheader={<>
                        <PostBody
                            classes={classes}
                            collapsible={collapsible}
                            mentions={mentions}
                            postData={postData}
                        />
                        {!disableButtons && <PostButtons
                            allowedExtras={allowedExtras}
                            classes={classes}
                            isReply={isReply}
                            mentions={mentions}
                            onChange={handleChange}
                            onDelete={handleDelete}
                            postData={postData}
                            showRepliesCounter={showRepliesCounter}
                            type={type}
                            userData={userData}
                        />}
                    </>}
                />
            </Wrapper.type>
        </Card>
        {level !== undefined && <RepliesTree
            allowedExtras={allowedExtras}
            level={level}
            postId={postData.id}
            classes={classes}
            onChange={handleChange}
            onDelete={handleDelete}
            type={type}
        />}
    </>
    // }, [newReply, deletePost, postData, postData.counter("replied"), postData.counter("like")])
}
