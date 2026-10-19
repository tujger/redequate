import {delay} from "../../../common";
import {notify, read} from "./common";
import saveCurrentProfile from "../common/saveCurrentProfile";

export default async function updateProfile(auth, fields) {
    await delay("LocalAuth", "updateProfile");
    await saveCurrentProfile(auth, fields);
    notify(auth, (await read(auth)).revision);
}
