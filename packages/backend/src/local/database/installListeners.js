import {handlers} from "../../common";
import {identifier} from "../../../../common";
import onEvents from "./onEvents";

const registrations = Object.values(handlers).map(Listener => ({Listener, id: identifier()}));

export const installListeners = backend => {
    for (const {Listener, id} of registrations) {
        onEvents(new Listener(backend), id)(backend);
    }
};
