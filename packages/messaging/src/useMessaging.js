import {useContext} from "react";
import {_AppContext} from "../../_common/AppContext";

export default () => {
    const {messaging} = useContext(_AppContext);
    if (!messaging) throw new Error("useMessaging requires a Dispatcher Messaging provider");
    return messaging;
};
