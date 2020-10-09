import React from "react";
import ModalComponent from "../../components/ModalComponent";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import BackIcon from "@material-ui/icons/ArrowBack";
import Hidden from "@material-ui/core/Hidden";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import SearchContent from "./SearchContent";

export default ({open, onClose, classes, handleSearch, ...props}) => {
    return <ModalComponent onClose={onClose}>
        <Hidden mdUp>
            <Grid container alignItems={"center"} justify={"space-between"}>
                <IconButton onClick={() => {
                    onClose();
                }}>
                    <BackIcon/>
                </IconButton>
                <Button
                    onClick={handleSearch}
                    variant={"contained"}
                    color={"secondary"}
                    className={classes.button}
                >Search</Button>
            </Grid>
        </Hidden>
        <Hidden smDown>
            <DialogTitle id={"alert-dialog-title"}>Reply</DialogTitle>
        </Hidden>
        <DialogContent>
            <Grid container>
                <SearchContent {...props}/>
            </Grid>
        </DialogContent>
        <Hidden smDown>
            <DialogActions>
                <Button onClick={onClose} color={"secondary"}>Cancel</Button>
                <Button onClick={handleSearch} color={"secondary"}>Search</Button>
            </DialogActions>
        </Hidden>

    </ModalComponent>
}
