import React from "react";
import DispatchedConfirmComponent from "../../components/DispatchedConfirmComponent";
import MainContent from "../../components/MainContent";
import Snackbar from "../../components/Snackbar";
import {NotificationsSnackbar} from "../../controllers/Notifications";
import BottomToolbar from "./BottomToolbar";
import styles from "./styles/BottomToolbarLayout.module.css";
import Titlebar from "./Titlebar";

export default (props) => {
    const {footerComponent, menu} = props;

    return <div className={styles.container} data-bottom-toolbar>
        <Titlebar {...props}/>
        <div aria-hidden="true" className={styles.indent}/>
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
