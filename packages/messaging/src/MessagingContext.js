import {createContext, useContext} from "react";

const MessagingContext = createContext(null);

export default MessagingContext.Provider;

export const useMessaging = () => {
    const messaging = useContext(MessagingContext);
    if (!messaging) throw new Error("useMessaging requires a Dispatcher Messaging provider");
    return messaging;
};
