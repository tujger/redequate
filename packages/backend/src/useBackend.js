import {useContext} from "react";
import {_AppContext} from "../../_common/AppContext";

export default () => {
    const backend = useContext(_AppContext)?.backend;
    if (!backend) throw new Error("useBackend requires a Dispatcher Backend provider");
    return backend;
};
