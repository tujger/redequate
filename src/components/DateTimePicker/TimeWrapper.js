import React from "react";
import TimeKeeper from "react-timekeeper";
import styles from "./styles/TimeWrapper.module.css";

export default ({time, onSelect}) => {
    return <div className={styles.clock}>
        <TimeKeeper
            closeOnMinuteSelect
            doneButton={() => <button hidden type={"button"}/>}
            hour24Mode={false}
            onDoneClick={onSelect}
            time={time ? {hour: time.hours(), minute: time.minutes()} : null}
            switchToMinuteOnHourSelect
        />
    </div>;
};
