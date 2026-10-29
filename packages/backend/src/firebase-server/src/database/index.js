import {handlers} from "../../../common";
import FirebaseServerBackend from "./FirebaseServerBackend.js";
import create from "./callable/create";
import deleteRecord from "./callable/delete";
import onEvents from "./onEvents";
import update from "./callable/update";

export {create, update, deleteRecord as delete};

const backend = new FirebaseServerBackend();
const triggers = Object.entries(handlers).reduce((acc, [name, Listener]) => {
    acc[name] = onEvents(new Listener(backend));
    return acc;
}, {});

export const oncreate = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onCreate).map(([name, events]) => [name, events.onCreate]));
export const ondelete = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onDelete).map(([name, events]) => [name, events.onDelete]));
export const onupdate = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onUpdate).map(([name, events]) => [name, events.onUpdate]));
