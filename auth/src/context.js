import {createContext, useContext} from "react";

export const Context = createContext(null);

export const AuthContext = Context.Provider;

export const useAuth = () => {
    const auth = useContext(Context);
    if (!auth) throw new Error("useAuth requires a Dispatcher Auth provider");
    return auth;
};
