import {notImplemented} from "../../_common/src/_packages";

export default class BackendBase {
    async invoke(name, args) {
        return notImplemented("invoke");
    }

    async request(name, args) {
        return notImplemented("request");
    }
}
