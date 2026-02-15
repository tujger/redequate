import BackIcon from "@mui/icons-material/ArrowBack";
import {Button, DialogActions, DialogContent, DialogTitle, Grid, Hidden, IconButton} from "@mui/material";
import React from "react";
import ModalComponent from "../../components/ModalComponent";
import SearchContent from "./SearchContent";
import styles from './styles/Search.module.css'

export default ({open, onClose, handleSearch, ...props}) => {
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
                    className={styles.button}
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
