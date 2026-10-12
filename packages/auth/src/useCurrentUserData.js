import {useContext} from "react";
import {_AppContext} from "../../common/AppContext";

export default (userData) => {
    const context = useContext(_AppContext);
    if(userData) {
        context.currentUserData = userData;
    }
    return context?.currentUserData;
};
