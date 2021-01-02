import React from "react";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {useTranslation} from "react-i18next";

// eslint-disable-next-line react/prop-types
export default ({classes, date, start, end, onClick}) => {
    const {t} = useTranslation();

    if (!date && !start && !end) return null;
    if (date) {
        return <ButtonGroup variant={"text"} fullWidth>
            <Button
                children={date.local().format("L LT")}
                className={classes.sublabel}
            />
        </ButtonGroup>;
    }
    return <ButtonGroup variant={"text"} fullWidth>
        <Button
            children={start ? start.format("L LT") : "-"}
            className={classes.sublabel}
            onClick={() => onClick("start")}
            title={t("DateTimePicker.Select start date")}
        />
        <Button
            children={end ? end.format("L LT") : "-"}
            className={classes.sublabel}
            onClick={() => onClick("end")}
            title={t("DateTimePicker.Select end date")}
        />
    </ButtonGroup>
};
