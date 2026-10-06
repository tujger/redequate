import React from "react";
import InputPicker from "./InputPicker";
import Picker from "./Picker";

export default props => {
    const {inline, ...otherprops} = props;
    if (inline) {
        return <Picker {...otherprops}/>
    } else {
        return <InputPicker {...otherprops}/>
    }
};
