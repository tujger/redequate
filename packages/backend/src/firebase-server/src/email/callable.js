import {defineSecret} from "firebase-functions/params";
import backend from "../backend.js";
import authorize from "../common/authorize";
import {database} from "../common/firebase";
import onCall from "../common/onCall";

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

export default onCall({secrets: [gmailEmail, gmailPassword]}, async request => {
    await authorize(request, database, {adminOnly: true});
    const data = request.data;

    return backend.request("email.send", data);
});
