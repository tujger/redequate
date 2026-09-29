import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import React from "react";
import Button from "../controls/Button/Button";
import TextField from "../controls/TextField/TextField";

export default props => {
    const {
        color = undefined,
        disabled = false,
        helper = undefined,
        label = undefined,
        onChange,
        value = "",
    } = props;
    const [show, setShow] = React.useState(false);

    return <TextField
        clearable={false}
        color={color}
        disabled={disabled}
        endAdornment={<Button
            disabled={disabled}
            icon={show ? <Visibility/> : <VisibilityOff/>}
            onClick={() => setShow(current => !current)}
            onPointerDown={event => {
                event.preventDefault();
                event.stopPropagation();
            }}
            size={"small"}
            title={"Toggle password visibility"}
        />}
        error={!!helper}
        fullWidth
        helper={helper}
        label={label}
        onChange={onChange}
        type={show ? "text" : "password"}
        value={value}
    />
}
