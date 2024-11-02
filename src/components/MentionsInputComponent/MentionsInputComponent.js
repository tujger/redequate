import {ListItem, MenuItem, MenuList, Paper, Popper, TextField} from "@mui/material";
import React from "react";
import {useFirebase} from "../../controllers/General";
import LoadingComponent from "../LoadingComponent";
import styles from "./styles/MentionsInputComponent.module.css";

const MentionsInputComponent = React.lazy(() => import("./LazyMentionsComponent"));

export default props => {
    const firebase = useFirebase();
    return <React.Suspense fallback={<LoadingComponent/>}>
        <MentionsInputComponent
            firebase={firebase} {...props}
            classes={styles}
        />
        <TextField multiline style={{display: "none"}}/>
        <ListItem style={{display: "none"}}>ListItem-fake</ListItem>
        <MenuItem style={{display: "none"}}>MenuItem-fake</MenuItem>
        <Paper style={{display: "none"}}>Paper-fake</Paper>
        <Popper style={{display: "none"}} open={false} disablePortal>Popper-fake</Popper>
        <MenuList style={{display: "none"}}>MenuList-fake</MenuList>
    </React.Suspense>
}
