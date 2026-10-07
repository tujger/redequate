import moment from "moment";
import React from "react";
import {useTranslation} from "react-i18next";
import Select from "../../controls/Select/Select";

export default ({show, range, onSelect}) => {
    const {t} = useTranslation();
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!show) setOpen(false);
    }, [show]);

    if (!show) return null;

    const items = {
        today: {
            label: t("DateTimePicker.Today"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss"),
                    moment("00:00", "HH:ss").add(1, "day").subtract(1, "second"),
                )
            }
        },
        tomorrow: {
            label: t("DateTimePicker.Tomorrow"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").add(1, "day"),
                    moment("00:00", "HH:ss").add(2, "day").subtract(1, "second"),
                )
            }
        },
        yesterday: {
            label: t("DateTimePicker.Yesterday"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").subtract(1, "day"),
                    moment("00:00", "HH:ss").subtract(1, "second"),
                )
            }
        },
        week: {
            label: t("DateTimePicker.This week"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0),
                    moment("00:00", "HH:ss").weekday(0).add(1, "week").subtract(1, "second"),
                )
            }
        },
        nextweek: {
            label: t("DateTimePicker.Next week"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0).add(1, "week"),
                    moment("00:00", "HH:ss").weekday(0).add(2, "week").subtract(1, "second"),
                )
            }
        },
        lastweek: {
            label: t("DateTimePicker.Last week"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0).subtract(1, "week"),
                    moment("00:00", "HH:ss").weekday(0).subtract(1, "second"),
                )
            }
        },
        month: {
            label: t("DateTimePicker.This month"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").date(1),
                    moment("00:00", "HH:ss").date(1).add(1, "month").subtract(1, "second"),
                )
            }
        },
        nextmonth: {
            label: t("DateTimePicker.Next month"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").date(1).add(1, "month"),
                    moment("00:00", "HH:ss").date(1).add(2, "month").subtract(1, "second"),
                )
            }
        },
        lastmonth: {
            label: t("DateTimePicker.Last month"),
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").date(1).subtract(1, "month"),
                    moment("00:00", "HH:ss").date(1).subtract(1, "second"),
                )
            }
        },
    };

    const menu = range
        ? [["today", "tomorrow", "yesterday"], ["week", "nextweek", "lastweek"], ["month", "nextmonth", "lastmonth"]]
        : [["today", "yesterday", "tomorrow"]];
    const options = menu.reduce((result, group, index) => {
        if (index) result.push("-");
        group.forEach(item => result.push({
            id: item,
            label: items[item].label,
            value: item,
        }));
        return result;
    }, []);

    return <Select
        color={"secondary"}
        displayEmpty
        iconMenu
        onChange={event => items[event.target.value]?.onSelect?.()}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        options={options}
    />
};
