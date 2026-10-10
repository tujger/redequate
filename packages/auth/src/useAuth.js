import {useContext} from "react";
import {_AppContext} from "../../_common/AppContext";

export default () => {
    const {auth} = useContext(_AppContext);
    if (!auth) throw new Error("useAuth requires a Dispatcher Auth provider");
    return auth;
};
