import React from 'react';
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import Skeleton from "@material-ui/lab/Skeleton";
import Grid from "@material-ui/core/Grid";

const ItemPlaceholderComponent = ({classes, label}) => (
    <Card className={[classes.card].join(" ")}>
        <CardHeader
            className={classes.cardHeader}
            avatar={<Skeleton
                animation={false}
                variant="circle"
                className={classes.avatar}
            />}
            title={label !== true
                ? label
                : <Skeleton
                    animation="wave"
                    height={12}
                    width="40%"
                    style={{marginBottom: 6}}
                />}
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
        />
    </Card>
)

export default ItemPlaceholderComponent;
