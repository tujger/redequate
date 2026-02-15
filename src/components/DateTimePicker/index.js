import {MobileDateTimePicker, StaticDateTimePicker} from '@mui/x-date-pickers'
import dayjs from 'dayjs';
import React from 'react'
import styles from "./styles/DateTimePicker.module.css";

export default ({
                    inline,
                    ...props
                }) => {
    const [start, setStart] = React.useState(() => dayjs())
    const [end, setEnd] = React.useState(() => dayjs())

    const Picker = inline ? StaticDateTimePicker : MobileDateTimePicker;

    return <div className={[styles.range, inline ? styles.inline : styles.popup].join(" ")}>
        <Picker {...props} value={start} onChange={e => setStart(e)}/>
        <span className={styles.period}>-</span>
        <Picker {...props} value={end} onChange={e => setEnd(e)} minDate={start}/>
    </div>
}
