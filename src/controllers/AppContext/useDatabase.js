import {useContext} from "react";
import {_AppContext} from "./_common";

export default () => {
    const database = useContext(_AppContext)?.database;
    if (!database) throw new Error("useDatabase requires a Dispatcher Database provider");
    return database;
};
