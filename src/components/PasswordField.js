import React from "react";
import PropTypes from "prop-types";
import {FormControl} from "@mui/material";
import {FormHelperText} from "@mui/material";
import {IconButton} from "@mui/material";
import {Input} from "@mui/material";
import {InputAdornment} from "@mui/material";
import {InputLabel} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const PasswordField = props => {
    const {label, onChange, color, helper, disabled = false} = props;
    const [values, setValues] = React.useState({
        password: "",
        show: false
    });

    const handleClickShow = () => {
        setValues({...values, show: !values.show});
    };

    const handleChange = (event) => {
        setValues({...values, password: event.target.value});
        onChange(event);
    };

    return <FormControl fullWidth>
        <InputLabel color={color}>{label}</InputLabel>
        <Input
            color={color}
            disabled={disabled}
            onChange={handleChange}
            type={values.show ? "text" : "password"}
            value={values.password}
            error={!!helper}
            endAdornment={
                <InputAdornment position={"end"}>
                    <IconButton
                        aria-label={"toggle password visibility"}
                        onClick={handleClickShow}
                        onMouseDown={event => event.preventDefault()}
                    >
                        {values.show ? <Visibility/> : <VisibilityOff/>}
                    </IconButton>
                </InputAdornment>
            }
        />
        {helper && <FormHelperText error>{helper}</FormHelperText>}
    </FormControl>
};

PasswordField.propTypes = {
    label: PropTypes.string,
    onChange: PropTypes.func,
    helper: PropTypes.string,
    disabled: PropTypes.bool
};

export default PasswordField;
