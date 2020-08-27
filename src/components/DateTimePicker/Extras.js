import React from "react";
import moment from "moment";
import {Divider, IconButton, Menu, MenuItem} from "@material-ui/core";
import {MoreVert as MenuIcon} from "@material-ui/icons";

// eslint-disable-next-line react/prop-types
export const Extras = ({show, range, onSelect}) => {
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    if (!show) return null;

    const onItemClick = ({currentTarget}) => {
        setState({...state, anchor: null});
        items[currentTarget.id].onSelect && items[currentTarget.id].onSelect();
    };

    const items = {
        "today": {
            label: "Today",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss"),
                    moment("00:00", "HH:ss").add(1, "day").subtract(1, "second"),
                )
            }
        },
        "tomorrow": {
            label: "Tomorrow",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").add(1, "day"),
                    moment("00:00", "HH:ss").add(2, "day").subtract(1, "second"),
                )
            }
        },
        "yesterday": {
            label: "Yesterday",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").subtract(1, "day"),
                    moment("00:00", "HH:ss").subtract(1, "second"),
                )
            }
        },
        "week": {
            label: "This week",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0),
                    moment("00:00", "HH:ss").weekday(0).add(1, "week").subtract(1, "second"),
                )
            }
        },
        "nextweek": {
            label: "Next week",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0).add(1, "week"),
                    moment("00:00", "HH:ss").weekday(0).add(2, "week").subtract(1, "second"),
                )
            }
        },
        "lastweek": {
            label: "Last week",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").weekday(0).subtract(1, "week"),
                    moment("00:00", "HH:ss").weekday(0).subtract(1, "second"),
                )
            }
        },
        "month": {
            label: "This month",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").date(1),
                    moment("00:00", "HH:ss").date(1).add(1, "month").subtract(1, "second"),
                )
            }
        },
        "nextmonth": {
            label: "Next month",
            onSelect: () => {
                onSelect(
                    moment(range ? "00:00" : "12:00", "HH:ss").date(1).add(1, "month"),
                    moment("00:00", "HH:ss").date(1).add(2, "month").subtract(1, "second"),
                )
            }
        },
        "lastmonth": {
            label: "Last month",
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
