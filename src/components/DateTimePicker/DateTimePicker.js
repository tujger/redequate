import React from "react";
import withStyles from "@material-ui/styles/withStyles";
import PropTypes from "prop-types";
import {Picker} from "./Picker";
import {InputPicker} from "./InputPicker";
import {styles} from "./currentStyles";

const DateTimePicker = props => {
    const {inline, ...otherprops} = props;
    if (inline) {
        return <Picker {...otherprops}/>
    } else {
        return <InputPicker {...otherprops}/>
    }
};

const StyledDateTimePicker = withStyles(styles)(DateTimePicker);

StyledDateTimePicker.propTypes = {
    inline: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    // date: PropTypes.objectOf(moment) || undefined || null,
    // start: PropTypes.objectOf(moment) || undefined || null,
    // end: PropTypes.objectOf(moment) || undefined || null,
    extras: PropTypes.bool,
    range: PropTypes.bool,
    InputProps: PropTypes.any,
    PopoverProps: PropTypes.any,
};

export default StyledDateTimePicker;
