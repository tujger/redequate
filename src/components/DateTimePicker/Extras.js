import React from "react";
import moment from "moment";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import MenuIcon from "@material-ui/icons/MoreVert";
import {useTranslation} from "react-i18next";

// eslint-disable-next-line react/prop-types
export default ({show, range, onSelect}) => {
    const {t} = useTranslation();
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    if (!show) return null;

    const onItemClick = ({currentTarget}) => {
        setState({...state, anchor: null});
        items[currentTarget.id].onSelect && items[currentTarget.id].onSelect();
    };

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

    return <div>
        <IconButton onClick={ev => setState({...state, anchor: ev.currentTarget})}>
            <MenuIcon/>
        </IconButton>
        <Menu
            anchorEl={anchor}
            keepMounted
            onClose={() => setState({...state, anchor: null})}
            open={Boolean(anchor)}
        >
            {menu.map((group, index) => <div key={index}>
                {group.map((item) => <MenuItem
                    id={item}
                    key={item}
                    onClick={onItemClick}
                >{items[item].label}</MenuItem>)}
                {(index < menu.length - 1) && <Divider/>}
            </div>)}
        </Menu>
    </div>
};
