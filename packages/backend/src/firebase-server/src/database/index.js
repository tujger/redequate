import {handlers} from "../../../common";
import backend from "../backend";
import create from "./callable/create";
import deleteRecord from "./callable/delete";
import update from "./callable/update";
import onEvents from "./onEvents";

export {create, update, deleteRecord as delete};

const triggers = Object.entries(handlers).reduce((acc, [name, Listener]) => {
    acc[name] = onEvents(new Listener(backend));
    return acc;
}, {});

export const oncreate = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onCreate).map(([name, events]) => [name, events.onCreate]));
export const ondelete = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onDelete).map(([name, events]) => [name, events.onDelete]));
export const onupdate = Object.fromEntries(Object.entries(triggers).filter(([, events]) => events.onUpdate).map(([name, events]) => [name, events.onUpdate]));
