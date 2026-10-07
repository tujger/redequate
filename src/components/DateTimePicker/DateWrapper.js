import LeftIcon from "@mui/icons-material/ChevronLeft";
import RightIcon from "@mui/icons-material/ChevronRight";
import moment from "moment";
import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Button from "../../controls/Button/Button";
import ClockButtons from "./ClockButtons";
import DateButtons from "./DateButtons";
import Extras from "./Extras";
import styles from "./styles/DateWrapper.module.css";
import TodayButton from "./TodayButton";

export default props => {
    const {style, range, date, start, end, onSelect, extras = true, onClockClick, onDateClick, onExtraSelect} = props;
    const [state, setState] = React.useState({monthPicker: false, toDate: null});
    const {monthPicker, toDate} = state;

    const dayClassName = (day) => {
        const d = moment(day);
        if (date && d.isSame(date, "day")) return styles.selected;
        else if (d.isSame(moment(), "day")) return styles.current;
        else if (range && d.isSame(start, "day")) return styles.selected;
        else if (range && d.isSame(end, "day")) return styles.selected;
        else if (range && d.isSameOrAfter(start, "day") && d.isSameOrBefore(end, "day")) return styles.range;
        return styles.regular;
    };

    const monthClassName = (month) => {
        if (date && month === date.month()) return styles.selected;
        else if (range && start && month === start.month()) return styles.selected;
        else if (range && end && month === end.month()) return styles.selected;
        else if (range && start && month > start.month() && end && end && month < end.month()) return styles.range;
        else if (month === moment().month()) return styles.current;
        return styles.regular;
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

    const CustomDateHeader = (
        {
            date,
            changeYear,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled
        }) => {
        return <div className={styles.headerControls}>
            <Button
                disabled={prevMonthButtonDisabled}
                icon={<LeftIcon/>}
                onClick={monthPicker ? () => {
                    changeYear(date.getFullYear() - 1)
                } : decreaseMonth}
            />
            <Button
                color={"inherit"}
                fullWidth
                onClick={() => setState({
                    ...state,
                    monthPicker: !monthPicker
                })}
                variant={"text"}
            >
                {moment(date).format((monthPicker ? "" : "MMMM ") + "YYYY")}
            </Button>
            <Button
                disabled={nextMonthButtonDisabled}
                icon={<RightIcon/>}
                onClick={monthPicker ? () => {
                    changeYear(date.getFullYear() + 1)
                } : increaseMonth}
            />
        </div>
    };

    return <DatePicker
        calendarClassName={styles.calendar}
        dayClassName={dayClassName}
        dropdownMode={"scroll"}
        endDate={end && end.toDate()}
        fixedHeight
        inline={true}
        maxDate={!start && end ? end.toDate() : null}
        minDate={start && !end ? start.toDate() : null}
        monthClassName={monthClassName}
        daynameClassName={styles.regular}
        headerClassName={styles.header}
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
        <DateButtons date={date} end={end} onClick={onDateClick} start={start}/>
        {!range && <div className={styles.actions}>
            <ClockButtons date={date} onClick={onClockClick} show={!range && !monthPicker && date}/>
            <TodayButton onClick={onTodayClick} show={showToday()}/>
            <Extras onSelect={onExtraSelect} show={showToday() && extras}/>
        </div>}
        {range && <ClockButtons
            end={end}
            onClick={onClockClick}
            range
            show={!monthPicker && range}
            start={start}
        />}
        {range && <div className={styles.rangeActions}>
            <TodayButton onClick={onTodayClick} show={showToday()}/>
            <Extras onSelect={onExtraSelect} range show={showToday() && extras}/>
        </div>}
        <style>{style}</style>
    </DatePicker>;
}
