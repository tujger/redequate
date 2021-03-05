import React from "react";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Skeleton from "@material-ui/lab/Skeleton";
import Grid from "@material-ui/core/Grid";
import withStyles from "@material-ui/styles/withStyles";
import AvatarView from "./AvatarView";
import {stylesList} from "../controllers/Theme";

const ItemPlaceholderComponent = ({avatar, classes, className, label, onClick, pattern}) => (
    <Card
        className={[
            classes.card,
            pattern ? classes[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : "",
            className,
        ].join(" ")}
        onClick={onClick}
    >
        <CardHeader
            avatar={avatar !== null && (avatar || (label
                ? <AvatarView
                    className={classes.avatar}
                    image={avatar}
                    initials={label}
                    verified={true}
                />
                : <Skeleton
                    animation={label ? false : "wave"}
                    className={classes.avatar}
                    variant={"circle"}
                />))}
            className={[classes.cardHeader, "", label ? classes.cardHeaderWithLabel : ""].join(" ")}
            disableTypography
            subheader={!label && <>
                <Skeleton
                    animation={"wave"}
                    height={12}
                    style={{marginBottom: 6}}
                    width={"100%"}
                />
                <Grid
                    className={classes.cardActions}>
                    <Skeleton
                        animation={false}
                        height={10}
                        style={{marginBottom: 6}}
                        variant={"rect"}
                        width={"100%"}
                    />
                </Grid>
            </>}
            title={label || <Skeleton
                animation={"wave"}
                height={12}
                style={{marginBottom: 6}}
                width={"40%"}
            />}
        />
    </Card>
)

export default withStyles(stylesList)(ItemPlaceholderComponent);
