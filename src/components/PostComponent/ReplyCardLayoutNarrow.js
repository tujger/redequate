import React from "react";
import {Link} from "react-router-dom";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import PostBody from "./PostBody";
import {usePages, useWindowData} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostButtons from "./PostButtons";
import PostMenu from "./PostMenu";

export default React.forwardRef((props, ref) => {
    const {
        classes = {},
        className,
        disableClick,
        disableButtons,
        level,
        pattern,
        postData,
        userData,
        highlighted,
    } = props;

    const pages = usePages();
    const windowData = useWindowData();
    const ancillaryRef = React.useRef();

    return <Card
        className={[
            classes.card,
            pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            highlighted ? classes.cardHighlighted : "",
            className
        ].join(" ")}
        ref={ref}>
        <CardHeader
            classes={{content: classes.cardContent, subheader: classes.cardSubheader}}
            className={[classes.cardHeader, classes.cardHeaderWithLabel, classes.post, classes.reply].join(" ")}
            avatar={<Link
                className={level > 1 ? classes.avatarSmallest : classes.avatarSmall}
                onClick={evt => evt.stopPropagation()}
                to={pages.user.route + postData.uid}
            >
                <AvatarView
                    className={level > 1 ? classes.avatarSmallest : classes.avatarSmall}
                    image={userData.image}
                    initials={userData.initials}
                    verified={true}
                />
            </Link>}
            title={<Grid container>
                <Grid
                    className={classes.userName}
                    item
                >
                    <Link
                        to={pages.user.route + userData.id}
                        onClick={evt => evt.stopPropagation()}
                        className={[classes.label].join(" ")}
                    >{userData.name}</Link>
                </Grid>
                {windowData.isNarrow() && <Grid item xs/>}
                <PostMenu {...props}/>
                <Grid item className={classes.date} title={new Date(postData.created).toLocaleString()}>
                    {toDateString(postData.created)}
                </Grid>
            </Grid>}
            subheader={<>
                <PostBody
                    {...props}
                    ref={ancillaryRef}
                    disableClick={!disableClick}
                />
                {postData.images && <Grid
                    className={classes.cardImage}
                    container
                >
                    <PostMedia
                        images={postData.images}
                        // inlineCarousel={!disableClick}
                        mosaic
                    />
                </Grid>}
                {!disableButtons && <PostButtons {...props} ancillaryRef={ancillaryRef}/>}
            </>}
        />
    </Card>
});
