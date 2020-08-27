import React from "react";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import withStyles from "@material-ui/styles/withStyles";
import {useTechnicalInfo} from "../controllers";

const styles = theme => ({
    root: {
        backgroundColor: "#880000",
        color: "#ffffff",
        justifyContent: "center",
        padding: theme.spacing(1),
    }
})

const TechnicalInfoView = ({classes, message}) => {
    const technical = useTechnicalInfo();
    const {maintenance} = technical;

    if (!maintenance && !message) return null;
    const {message: maintenanceMessage = "Sorry, the service is temporarily unavailable."} = maintenance || {};
    return <React.Fragment>
        <Grid container spacing={2} className={classes.root}>
            <h4>{message || maintenanceMessage}</h4>
        </Grid>
        <Box m={2}/>
    </React.Fragment>
};

export default withStyles(styles)(TechnicalInfoView);
