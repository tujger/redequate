import React from "react";
import TextField from "../../controls/TextField/TextField";
import ModalComponent from "../ModalComponent";
import normalizeDateInput from "./normalizedDateInput";
import Picker from "./Picker";

export default props => {
    const {disabled, label, format = "L LT", onChange, range, date: givenDate, start: givenStart, end: givenEnd, color = "primary"} = props;
    const [anchor, setAnchor] = React.useState(null);

    React.useEffect(() => {
        if (disabled) setAnchor(null);
    }, [disabled]);

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

    const openPicker = event => {
        if (!disabled) setAnchor(event.currentTarget.closest("label"));
    };
    const closePicker = event => {
        setAnchor(null);
        if (event?.key === "Escape") {
            anchor?.querySelector("input")?.focus();
        }
    };
    const selectDate = (...args) => {
        setAnchor(null);
        anchor?.querySelector("input")?.focus();
        onChange(...args);
    };
    const handleFieldChange = event => {
        if (event.target.value === "") {
            onChange(null, null);
        }
    };

    return <>
        <TextField
            clearable
            color={color}
            disabled={disabled}
            fullWidth
            label={label}
            onChange={handleFieldChange}
            onClick={openPicker}
            onKeyDown={event => {
                if (disabled || !["Enter", " ", "ArrowDown"].includes(event.key)) return;
                event.preventDefault();
                openPicker(event);
            }}
            readOnly
            title={valueRange()}
            value={valueRange()}
        />
        {anchor && <ModalComponent anchorEl={anchor} onClose={closePicker}>
            <Picker {...props} onChange={selectDate}/>
        </ModalComponent>}
    </>;
}
