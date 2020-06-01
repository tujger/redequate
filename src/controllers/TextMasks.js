import MaskedInput from "react-text-mask";
import emailMask from "text-mask-addons/dist/emailMask";
import React from "react";

export const TextMaskEmail = props => {
    const {inputRef, ...other} = props;
    return <MaskedInput
        {...other}
        ref={ref => {
            inputRef(ref ? ref.inputElement : null);
        }}
        mask={emailMask}
        placeholderChar={"\u2000"}
        showMask
    />
};

export const TextMaskPhone = props => {
    const {inputRef, ...other} = props;
    return <MaskedInput
        {...other}
        ref={ref => {
            inputRef(ref ? ref.inputElement : null);
        }}
        mask={["+", "1", " ", "(", /[1-9]/, /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/]}
        placeholderChar={"_"}
        showMask
    />
};
