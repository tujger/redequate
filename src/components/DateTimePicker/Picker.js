import React from "react";
import {TimeP} from "./TimeP";
import {DateP} from "./DateP";
import moment from "moment";
import {normalizeDateInput} from "./normalizedDateInput";
import {currentStyles} from "./currentStyles";

export const Picker = props => {
    const {classes, onChange, date: dateGiven, start: startGiven1, end: endGiven1, range, ...otherprops} = props;
    const date = normalizeDateInput(dateGiven);
    const startGiven = normalizeDateInput(startGiven1);
    const endGiven = normalizeDateInput(endGiven1);

    const [state, setState] = React.useState({showClock: null, start: startGiven, end: endGiven});
    const {showClock, start, end} = state;

    const clockStyles = `.react-timekeeper {
            box-shadow: ${currentStyles.clockContainer.boxShadow};
            background-color: ${currentStyles.clockContainer.backgroundColor};
            width: 100%;
        }
        .react-timekeeper__clock-wrapper {
            background-color: ${currentStyles.clockWrapper.backgroundColor};
            padding: ${currentStyles.clockWrapper.padding}px;
          }
          .react-timekeeper__top-bar {
            background-color: ${currentStyles.header.backgroundColor};
            border-bottom: ${currentStyles.header.borderBottomWidth}px ${currentStyles.header.borderBottomStyle} ${currentStyles.header.borderBottomColor};
            padding: ${currentStyles.header.padding}px;
            text-align: center;
          }
          .react-timekeeper__clock {
            background-color: ${currentStyles.clock.backgroundColor};
          }
          .react-timekeeper__clock-hours > span,
          .react-timekeeper__clock-minutes > span {
            color: ${currentStyles.clock.color};
          }`;

    const onClockSelect = value => {
        let changing = {
            date: date,
            start: startSelected,
            end: endSelected || startSelected
        }[showClock];
        if (!changing) return;
        changing = changing.hours(value.hour).minutes(value.minute);
        let newstate = {...state, start: startSelected, end: endSelected, [showClock]: changing};
        if (range) {
            if (showClock === "start" && !newstate.end) {
                setState({...newstate, showClock: null});
            } else {
                setState({...newstate, start: undefined, end: undefined, showClock: null});
                if (newstate.end.isSameOrAfter(newstate.start)) {
                    onChange(newstate.start, newstate.end);
                }
            }
        } else {
            setState({...newstate, showClock: null});
            onChange(newstate.date);
        }
    };

    const onClockClick = value => {
        setState({...state, showClock: value});
    };

    const onDateClick = value => {
        setState({...state, start: startSelected, end: endSelected, [value]: null});
    };

    const onDateSelect = (value) => {
        value = moment(value);
        if (range) {
            let newstate = {...state};
            if (start && end) {
                newstate = {...state, start: value, end: null};
            } else if (!start) {
                newstate.start = value;
            } else {
                newstate.end = value;
            }
            if (newstate.start && newstate.end) {
                if (newstate.end.isSameOrAfter(newstate.start)) {
                    onChange(newstate.start, newstate.end);
                    setState({...newstate, start: undefined, end: undefined});
                }
            } else if (!newstate.end) {
                setState({...newstate, end: null});
            } else if (!newstate.start) {
                setState({...newstate, start: null});
            }
        } else {
            onChange(value);
        }
    };

    const onExtraSelect = (start, end) => {
        onChange(start, end);
        setState({...state, start: undefined, end: undefined});
    };

    const startSelected = start === undefined ? startGiven : start;
    const endSelected = end === undefined ? endGiven : end;

    if (showClock) {
        return <TimeP
            classes={classes}
            onSelect={onClockSelect}
            style={clockStyles}
            time={{date: date, start: startSelected, end: endSelected}[showClock]}
        />
    } else {
        return <DateP
            {...otherprops}
            classes={classes}
            date={date}
            end={endSelected}
            onClockClick={onClockClick}
            onDateClick={onDateClick}
            onExtraSelect={onExtraSelect}
            onSelect={onDateSelect}
            range={range}
            start={startSelected}
        />
    }
}
