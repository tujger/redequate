import React from "react";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import withStyles from "@material-ui/styles/withStyles";
import {useMetaInfo} from "../controllers/General";

const styles = theme => ({
    root: {
        backgroundColor: "#880000",
        color: "#ffffff",
        flexDirection: "column",
        justifyContent: "center",
        padding: theme.spacing(1),
        textAlign: "center",
        whiteSpace: "pre-wrap",
    }
})

const MetaInfoView = ({classes, message}) => {
    const metaInfo = useMetaInfo();
    const {maintenance} = metaInfo || {};

    if (!maintenance && !message) return null;
    const {
        message: maintenanceMessage = "Sorry, the service is temporarily unavailable.",
        person = {},
        timestamp
    } = maintenance || {};
    const {name, email} = person;
    return <>
        <Grid container spacing={2} className={classes.root}>
            <h4>{message || maintenanceMessage}</h4>
            {timestamp && <>
                <Typography variant={"caption"}>
                    Maintenance has been established by <a
                    href={"mailto:" + email}
                    style={{color: "inherit"}}>{name}</a> at {new Date(timestamp).toLocaleString()}
                </Typography>
                <Box m={1}/>
            </>}
        </Grid>
    </>
};

export default withStyles(styles)(MetaInfoView);
