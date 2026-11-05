import {defineSecret} from "firebase-functions/params";
import {HttpsError} from "firebase-functions/v2/https";
import nodemailer from "nodemailer";

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

export default async function sendMail({secrets: [email, password] = [gmailEmail, gmailPassword], ...payload}) {

    const {data, ...fields} = payload;
    for (const field of ["from", "to", "subject", "message"]) {
        if (typeof fields[field] !== "string" || !fields[field].trim()) {
            throw new HttpsError("invalid-argument", `${field} is required.`, {code: "email-send/invalid-argument"},);
        }
    }
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        console.info("[Email:Send] sent with emulator", fields);
        return {info: {messageId: "emulator-mail", accepted: [fields.to], rejected: []}};
    }
    const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {user: email.value(), pass: password.value()},
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
}
