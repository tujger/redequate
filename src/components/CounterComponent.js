import React from "react";
import {useFirebase} from "../controllers";

export default ({counter, path, prefix, suffix, live = false, onChange, showZero = false, zeroPrefix, zeroSuffix}) => {
    const firebase = useFirebase();
    const [state, setState] = React.useState({});
    const {value} = state;

    React.useEffect(() => {
        if (counter !== undefined) setState(state => ({...state, value: counter}));
        if (!path) return;
        if (counter === undefined && !live) return;
        const onValueChange = snapshot => {
            if (snapshot.exists()) {
                const newValue = snapshot.val();
                setState(state => {
                    if (state.value !== newValue && onChange) onChange(newValue, state.value);
                    return ({...state, value: newValue})
                });
            }
        };
        const ref = firebase.database().ref("_counters").child(path);
        if (live || counter !== undefined) {
            ref.on("value", onValueChange);
        } else {
            ref.once("value", onValueChange);
        }
        return () => {
            ref.off("value", onValueChange);
        }
    }, [path, counter])

    if (!value && !showZero) return null;
    return <>
        {(!value && zeroPrefix) ? zeroPrefix : prefix}{value || 0}{(!value && zeroSuffix) ? zeroSuffix : suffix}
    </>
}
