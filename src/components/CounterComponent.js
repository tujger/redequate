import React from "react";
import counterControl from "../controllers/counterControl";

export default ({counter, path, prefix, suffix, live = false, onChange, showZero = false, zeroPrefix, zeroSuffix}) => {
    const [state, setState] = React.useState({});
    const {value} = state;

    React.useEffect(() => {
        if (counter !== undefined) setState(state => ({...state, value: counter}));
        if (!path) return;
        if (counter === undefined && !live) return;
        const listener = counterControl({
            onchange: newValue => {
                setState(state => {
                    if (state.value !== newValue && onChange) onChange(newValue, state.value);
                    return ({...state, value: newValue})
                });
            },
            path
        })
        return () => listener();
    }, [path, counter])

    if (!value && !showZero) return null;
    return <>
        {(!value && zeroPrefix) ? zeroPrefix : prefix}{value || 0}{(!value && zeroSuffix) ? zeroSuffix : suffix}
    </>
}
