import React from "react";
import {Picker} from "./Picker";
import {IconButton, InputAdornment, Popover, TextField} from "@material-ui/core";
import {Cancel} from "@material-ui/icons";
import {normalizeDateInput} from "./normalizedDateInput";

export const InputPicker = props => {
    // eslint-disable-next-line react/prop-types
    const {classes, disabled, label, format = "L LT", onChange, range, date: givenDate, start: givenStart, end: givenEnd, InputProps, PopoverProps, color = "primary"} = props;
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;

    const date = normalizeDateInput(givenDate);
    const start = normalizeDateInput(givenStart);
    const end = normalizeDateInput(givenEnd);

    const valueRange = () => {
        if (range) {
            if (!start && !end) return "";
            return (start ? start.format(format) : "n/a") +
                " - " +
                (end ? end.format(format) : "n/a")
        } else {
            return date ? date.format(format) : "";
        }
    };

    const Popup = () => <Popover
        classes={{paper: classes.popper}}
        anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
        }}
        transformOrigin={{
            vertical: "top",
            horizontal: "center",
        }}
        {...PopoverProps}
        anchorEl={anchor}
        children={<Picker
            {...props}
            onChange={(...args) => {
                setState({...state, anchor: null});
                onChange(...args);
            }}
        />}
        onClose={() => setState({...state, anchor: null})}
        open={true}
    />;

    return <React.Fragment>
        <TextField
            color={color}
            disabled={disabled}
            label={label}
            fullWidth
            title={valueRange()}
            value={valueRange()}
            InputProps={{
                endAdornment: (((InputProps && InputProps.value) || valueRange()) && !disabled)
                    ? <InputAdornment position='end'>
                        <IconButton
                            aria-label={"clear"}
                            children={<Cancel/>}
                            edge={"end"}
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(null, null);
                            }}
                            title={"Clear"}
                        />
                    </InputAdornment> : null,
                value: valueRange(),
                ...InputProps
            }}
            onClick={(event) => {
                if (disabled) return;
                setState({
                    ...state,
                    anchor: event.currentTarget,
                });
            }}
            readOnly
        />
        {Boolean(anchor) && <Popup/>}
    </React.Fragment>
}
