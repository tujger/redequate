import React from "react";
import Button from "@material-ui/core/Button";
import {useTranslation} from "react-i18next";

// eslint-disable-next-line react/prop-types
export default props => {
    const {t} = useTranslation();
    const {show, todayButton = t("DateTimePicker.Now"), onClick} = props;

    if (!show) return null;

    return <Button
        children={todayButton}
        fullWidth
        onClick={onClick}
        variant={"text"}
    />
}
