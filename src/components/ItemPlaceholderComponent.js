import React from 'react';
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Skeleton from "@material-ui/lab/Skeleton";
import Grid from "@material-ui/core/Grid";
import AvatarView from "./AvatarView";
import {styles} from "./styles";
import withStyles from "@material-ui/styles/withStyles";

const ItemPlaceholderComponent = ({classes, label}) => (
    <Card className={[classes.card].join(" ")}>
        <CardHeader
            avatar={label ? <AvatarView initials={label} className={classes.avatar} verified={true}/>
                : <Skeleton
                    animation={label ? false : "wave"}
                    variant="circle"
                    className={classes.avatar}
                />}
            className={[classes.cardHeader, label ? classes.cardHeaderWithLabel : ""].join(" ")}
            subheader={!label && <React.Fragment>
                <Skeleton
                    animation="wave"
                    height={12}
                    width="100%"
                    style={{marginBottom: 6}}
                />
                <Grid
                    className={classes.cardActions}>
                    <Skeleton
                        animation={false}
                        variant="rect"
                        width="100%"
                        height={10}
                        style={{marginBottom: 6}}
                    />
                </Grid>
            </React.Fragment>}
            title={label ? label : <Skeleton
                animation="wave"
                height={12}
                width="40%"
                style={{marginBottom: 6}}
            />}
        />
    </Card>
)

export default withStyles(styles)(ItemPlaceholderComponent);
