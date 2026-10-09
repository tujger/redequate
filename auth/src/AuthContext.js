import {createContext, useContext} from "react";

const AuthContext = createContext(null);

export default AuthContext.Provider;

export const useAuth = () => {
    const auth = useContext(AuthContext);
    if (!auth) throw new Error("useAuth requires a Dispatcher Auth provider");
    return auth;
};
