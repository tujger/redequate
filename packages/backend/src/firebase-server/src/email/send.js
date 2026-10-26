import {defineSecret} from "firebase-functions/params";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import nodemailer from "nodemailer";
import authorize from "../common/authorize.js";
import {database} from "../common/firebase";

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

export default onCall({secrets: [gmailEmail, gmailPassword]}, async request => {
    await authorize(request, database, {adminOnly: true});
    const fields = request.data;
    for (const field of ["from", "to", "subject", "message"]) {
        if (typeof fields[field] !== "string" || !fields[field].trim()) {
            throw new HttpsError("invalid-argument", `${field} is required.`);
        }
    }
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        console.info("[Emulator] Email", fields);
        return {info: {messageId: "emulator-mail", accepted: [fields.to], rejected: []}};
    }
    const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {user: gmailEmail.value(), pass: gmailPassword.value()},
    });
    const info = await transport.sendMail({
        from: fields.from,
        replyTo: fields.from,
        to: fields.to,
        subject: fields.subject,
        text: fields.message,
        html: `<p>${fields.message}`,
    });
    return {info};
});
