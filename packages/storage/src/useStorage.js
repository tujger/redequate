import {useContext} from "react";
import {_AppContext} from "../../_common/AppContext";

export default () => {
    const storage = useContext(_AppContext)?.storage;
    if (!storage) throw new Error("useStorage requires a Dispatcher Storage provider");
    return storage;
};
