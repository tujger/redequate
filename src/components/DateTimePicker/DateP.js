import React from "react";
import {DateButtons} from "./DateButtons";
import {ClockButtons} from "./ClockButtons";
import {TodayButton} from "./TodayButton";
import {Extras} from "./Extras";
import moment from "moment";
import {Button, ButtonGroup, Grid} from "@material-ui/core";
import {ChevronLeft as LeftIcon, ChevronRight as RightIcon} from "@material-ui/icons";
import DatePicker from "react-datepicker-t";
import "react-datepicker-t/dist/react-datepicker.css";

export const DateP = props => {
    // eslint-disable-next-line react/prop-types
    const {classes, style, range, date, start, end, onSelect, extras = true, onClockClick, onDateClick, onExtraSelect} = props;
    const [state, setState] = React.useState({monthPicker: false, toDate: null});
    const {monthPicker, toDate} = state;

    const dayClassName = (day) => {
        const d = moment(day);
        if (date && d.isSame(date, "day")) return classes.selected;
        else if (d.isSame(moment(), "day")) return classes.current;
        else if (range && d.isSame(start, "day")) return classes.selected;
        else if (range && d.isSame(end, "day")) return classes.selected;
        else if (range && d.isSameOrAfter(start, "day") && d.isSameOrBefore(end, "day")) return classes.range;
        return classes.regular;
    };

    const monthClassName = (month) => {
        if (date && month === date.month()) return classes.selected;
        else if (range && start && month === start.month()) return classes.selected;
        else if (range && end && month === end.month()) return classes.selected;
        else if (range && start && month > start.month() && end && end && month < end.month()) return classes.range;
        else if (month === moment().month()) return classes.current;
        return classes.regular;
    };

    const showToday = () => {
        if (!range || !monthPicker) return true;
        if (range) {
            if (end && moment().isSameOrBefore(end)) {
                return true;
            } else if (start && moment().isSameOrAfter(start)) {
                return true;
            } else if (!start && !end) {
                return true;
            }
        }
    };

    const onTodayClick = () => {
        if (monthPicker) {
            setState({...state, toDate: moment(), monthPicker: false});
        } else {
            onSelect(moment());
        }
    };

    const onMonthSelect = value => {
        setState({...state, monthPicker: false, toDate: moment(value)});
    };

    // eslint-disable-next-line react/prop-types
    const CustomDateHeader = ({date, changeYear, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled}) => {
        return <Grid container alignItems={"center"}>
            <Grid item><Button
                children={<LeftIcon/>}
                disabled={prevMonthButtonDisabled}
                onClick={monthPicker ? () => {
                    changeYear(date.getFullYear() - 1)
                } : decreaseMonth}
                variant={"text"}
            /></Grid>
            <Grid item xs><Button
                children={moment(date).format((monthPicker ? "" : "MMMM ") + "YYYY")}
                onClick={() => setState({
                    ...state,
                    monthPicker: !monthPicker
                })}
                variant={"text"}
            /></Grid>
            <Grid><Button
                children={<RightIcon/>}
                disabled={nextMonthButtonDisabled}
                onClick={monthPicker ? () => {
                    changeYear(date.getFullYear() + 1)
                } : increaseMonth}
                variant={"text"}
            /></Grid>
        </Grid>
    };

    return <DatePicker
        calendarClassName={classes.calendar}
        dayClassName={dayClassName}
        dropdownMode={"scroll"}
        endDate={end && end.toDate()}
        fixedHeight
        inline={true}
        maxDate={!start && end ? end.toDate() : null}
        minDate={start && !end ? start.toDate() : null}
        monthClassName={monthClassName}
        daynameClassName={classes.regular}
        headerClassName={classes.header}
        onChange={() => {
        }}
        onSelect={monthPicker ? onMonthSelect : onSelect}
        openToDate={toDate && toDate.toDate()}
        renderCustomHeader={CustomDateHeader}
        selected={date && date.toDate()}
        selectsEnd={start && !end}
        selectsStart={!start}
        showMonthYearPicker={monthPicker}
        startDate={start && start.toDate()}
        timeCaption={"time"}
        timeFormat={"HH:mm"}
        timeIntervals={15}
    >
        <DateButtons {...props} onClick={onDateClick}/>
        {!range && <ButtonGroup>
            <ClockButtons date={date} onClick={onClockClick} show={!range && !monthPicker && date}/>
            <TodayButton onClick={onTodayClick} show={showToday()}/>
            <Extras onSelect={onExtraSelect} show={showToday() && extras}/>
        </ButtonGroup>}
        {range && <ClockButtons
            end={end}
            onClick={onClockClick}
            range
            show={!monthPicker && range}
            start={start}
        />}
        {range && <Grid container alignItems={"center"}>
            <Grid item xs><TodayButton onClick={onTodayClick} show={showToday()}/></Grid>
            <Extras onSelect={onExtraSelect} range show={showToday() && extras}/>
        </Grid>}
        <style>{style}</style>
    </DatePicker>;
}
