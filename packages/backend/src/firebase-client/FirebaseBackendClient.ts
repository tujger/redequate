import type {FirebaseApp} from "firebase/app";
import type {Functions} from "firebase/functions";
import {increment, serverTimestamp} from "firebase/database";
import {getFunctions, httpsCallable} from "firebase/functions";
import {BackendBase} from "../common";

export default class FirebaseBackendClient extends BackendBase {
    protected _functions: Functions;

    constructor({firebase}: {firebase: {app: FirebaseApp}}) {
        super();
        this._functions = getFunctions(firebase.app);
    }

    get TIMESTAMP() {
        return serverTimestamp();
    }

    increment(n: number) {
        return increment(n);
    }

    async request(name: string, ...args: unknown[]): Promise<unknown> {
        const endpoint = name.replaceAll(".", "-");
        const func = httpsCallable(this._functions, endpoint);
        const payload = args.length > 1 ? args : args[0];
        return func(payload).then(result => result.data);
    }
}
