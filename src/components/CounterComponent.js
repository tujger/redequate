import React from "react";
import {useDatabase} from "../controllers";
import counterControl from "../controllers/counterControl";

export default ({counter, path, prefix, suffix, live = false, onChange, showZero = false, zeroPrefix, zeroSuffix}) => {
    const database = useDatabase()
    const [state, setState] = React.useState({});
    const {value} = state;

    const latestOnChange = React.useRef(onChange);
    React.useEffect(() => { latestOnChange.current = onChange; }, [onChange]);

    React.useEffect(() => {
        let active = true;
        let previous = counter;
        if (counter !== undefined) setState({value: counter});
        if (!path) return;
        const receive = newValue => {
            if (!active) return;
            if ((live || counter !== undefined) && previous !== newValue) latestOnChange.current?.(newValue, previous);
            previous = newValue;
            setState({value: newValue});
        };
        if (!live && counter === undefined) {
            counterControl({database, path}).then(receive);
            return () => { active = false; };
        }
        const stop = counterControl({database, path, onchange: receive});
        return () => { active = false; stop(); };
    }, [database, path, counter, live]);

    if (!value && !showZero) return null;
    return <>
        {(!value && zeroPrefix) ? zeroPrefix : prefix}{value || 0}{(!value && zeroSuffix) ? zeroSuffix : suffix}
    </>
}
