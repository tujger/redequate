import React from "react";
import IconButton from "@material-ui/core/IconButton";
import InputAdornment from "@material-ui/core/InputAdornment";
import Popover from "@material-ui/core/Popover";
import TextField from "@material-ui/core/TextField";
import Cancel from "@material-ui/icons/Cancel";
import {useTranslation} from "react-i18next";
import normalizeDateInput from "./normalizedDateInput";
import Picker from "./Picker";

export default props => {
    // eslint-disable-next-line react/prop-types
    const {classes, disabled, label, format = "L LT", onChange, range, date: givenDate, start: givenStart, end: givenEnd, InputProps, PopoverProps, color = "primary"} = props;
    const [state, setState] = React.useState({anchor: null});
    const {anchor} = state;
    const {t} = useTranslation();

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
                            title={t("Common.Clear")}
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
