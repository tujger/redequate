import React from "react";
import {Link} from "react-router-dom";
import {CardHeader} from "@mui/material";
import {Card} from "@mui/material";
import {Grid} from "@mui/material";
import PostBody from "./PostBody";
import {usePages, useWindowData} from "../../controllers/General";
import AvatarView from "../AvatarView";
import {toDateString} from "../../controllers/DateFormat";
import PostMedia from "./PostMedia";
import PostButtons from "./PostButtons";
import PostMenu from "./PostMenu";
import styles from "./styles/PostComponent.module.css";

export default React.forwardRef((props, ref) => {
    const {
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
            styles.reply,
            // pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            highlighted ? styles.highlight : "",
            className
        ].join(" ")}
        ref={ref}>
        <CardHeader
            classes={{content: styles.cardContent, subheader: styles.cardSubheader}}
            className={[styles.header, styles.headerWithLabel, styles.post, styles.reply].join(" ")}
            avatar={<Link
                className={level > 1 ? styles.avatarSmallest : styles.avatarSmall}
                onClick={evt => evt.stopPropagation()}
                to={pages.user.route + postData.uid}
            >
                <AvatarView
                    className={level > 1 ? styles.avatarSmallest : styles.avatarSmall}
                    image={userData.image}
                    initials={userData.initials}
                    verified={true}
                />
            </Link>}
            title={<Grid container>
                <Grid
                    className={styles.userName}
                    item
                >
                    <Link
                        to={pages.user.route + userData.id}
                        onClick={evt => evt.stopPropagation()}
                        className={[styles.label].join(" ")}
                    >{userData.name}</Link>
                </Grid>
                {windowData.isNarrow() && <Grid item xs/>}
                <PostMenu {...props}/>
                <Grid item className={styles.date} title={new Date(postData.created).toLocaleString()}>
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
                    className={styles.cardImage}
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
