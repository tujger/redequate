import {handlers} from "../../common";
import onWrite from "./onWrite";

const listeners = Object.values(handlers).map(handler => onWrite(handler));
export const installListeners = backend => {
    for (const install of listeners) {
        install(backend);
    }
};
