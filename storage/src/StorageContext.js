import {createContext, useContext} from "react";

const StorageContext = createContext(null);

export default StorageContext.Provider;

export const useStorage = () => {
    const storage = useContext(StorageContext);
    if (!storage) throw new Error("useStorage requires a Dispatcher Storage provider");
    return storage;
};
