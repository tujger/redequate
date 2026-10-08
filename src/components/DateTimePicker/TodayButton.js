import React from "react";
import {useTranslation} from "react-i18next";
import Button from "../../controls/Button/Button";

export default props => {
    const {t} = useTranslation();
    const {show, todayButton = t("DateTimePicker.Now"), onClick} = props;

    if (!show) return null;

    return <Button
        fullWidth
        onClick={onClick}
        variant={"text"}
    >
        {todayButton}
    </Button>
}
