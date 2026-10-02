import React from "react";
import {useTranslation} from "react-i18next";
import Button from "../../controls/Button/Button";

// eslint-disable-next-line react/prop-types
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
