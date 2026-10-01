import React from "react";
import PropTypes from "prop-types";
import CssBaseline from "@material-ui/core/CssBaseline";
import Typography from "@material-ui/core/Typography";
import BottomToolbar from "./BottomToolbar";
import Titlebar from "./Titlebar";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import styles from "./styles/BottomToolbarLayout.module.css";

export default (props) => {
    const {footerComponent, menu} = props;

    return <div className={styles.container} data-bottom-toolbar>
        <CssBaseline/>
        <Titlebar {...props}/>
        <Typography className={styles.indent}/>
        <MainContent classes={{
            bottom: styles.bottom,
            bottomSticky: styles.bottomSticky,
            center: styles.center,
            left: styles.left,
            right: styles.right,
            topSticky: styles.topSticky,
            top: styles.top
        }}/>
        {footerComponent}
        <BottomToolbar items={menu}/>
        <Snackbar/>
        <NotificationsSnackbar/>
        <DispatchedConfirmComponent open={false}/>
    </div>
}
