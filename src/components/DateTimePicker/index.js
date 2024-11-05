import {StaticDateTimePicker} from '@mui/x-date-pickers'
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs'
import {MobileDateTimePicker} from '@mui/x-date-pickers'
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider'
import PropTypes from 'prop-types'
import React from 'react'
import DateRangePicker from "./DateRangePicker.js"

const DateTimePicker = ({
    inline,
    range,
    ...props
}) => {
    const Picker = React.useMemo(() => {
        if(range) {
            return DateRangePicker;
        } else if(inline) {
            return StaticDateTimePicker;
        } else {
            return MobileDateTimePicker;
        }
    }, [inline, range])

    return <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Picker inline={inline} {...props}/>
    </LocalizationProvider>
}

DateTimePicker.propTypes = {
    inline: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    // date: PropTypes.objectOf(moment) || undefined || null,
    // start: PropTypes.objectOf(moment) || undefined || null,
    // end: PropTypes.objectOf(moment) || undefined || null,
    extras: PropTypes.bool,
    range: PropTypes.bool,
    InputProps: PropTypes.any,
    PopoverProps: PropTypes.any,
}

export default DateTimePicker
