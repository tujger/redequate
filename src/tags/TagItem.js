import React from 'react';
import withStyles from "@material-ui/styles/withStyles";
import {useHistory} from "react-router-dom";
import Skeleton from "@material-ui/lab/Skeleton";
import CardHeader from "@material-ui/core/CardHeader";
import Card from "@material-ui/core/Card";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import CardActionArea from "@material-ui/core/CardActionArea";
import {usePages} from "../controllers/General";
import ItemPlaceholderComponent from "../components/ItemPlaceholderComponent";
import AvatarView from "../components/AvatarView";
import {stylesList} from "../controllers/Theme";
import MentionedTextComponent from "../components/MentionedTextComponent";
import TagIcon from "@material-ui/icons/Label";

const TagItem = ({data, classes, skeleton, label}) => {
    const pages = usePages();
    const history = useHistory();

    if (label) return <ItemPlaceholderComponent label={label} classes={classes} flat/>
    if (skeleton || !data) return <ItemPlaceholderComponent classes={classes} flat/>
    if (!data) return null;

    return <>
        <Card className={[classes.card, classes.cardFlat].join(" ")}>
            <CardActionArea
                className={classes.root}
                onClick={() => {
                history.push(pages.tag.route + data.key);
            }}>
                <CardHeader
                    classes={{content: classes.cardContent}}
                    className={[classes.cardHeader, classes.post].join(" ")}
                    avatar={data.value.image
                        ? <AvatarView className={classes.avatar} image={data.value.image} verified={true}/>
                        : <TagIcon className={classes.avatar}/>}
                    title={<Grid container>
                        <Grid item className={classes.userName}>
                            {data.value.label}
                        </Grid>
                    </Grid>}
                    subheader={<>
                        <Grid container>
                            <Typography variant={"body2"}>
                                <MentionedTextComponent
                                    disableClick
                                    className={classes.text}
                                    // mentions={}
                                    text={data.value.description}
                                />
                            </Typography>
                        </Grid>
                    </>}
                />
            </CardActionArea>
        </Card>
    </>
}
export default withStyles(stylesList)(TagItem);
