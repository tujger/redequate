import {fail} from "../../../../common";
import BackendListener from "../BackendListener";

export default class ChatListener extends BackendListener {
    constructor(backend) {
        super(["chats", "chat_id", "message_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Chat]", `created [${params.chat_id}/${params.message_id}]`, {params, value});

        const {text = "", uid} = value;
        const senderName = await this.backend.request("database.read", ["users_public", {user_id: uid}, "name"]);

        const data = {
            body: `${senderName}: ${text}`.replace(/\$\[.*?:.*?:(.*?)]/g, "$1"),
            tag: this.backend.projectUrl + "/chat/" + uid,
            type: "chat",
        };

        const members = await this.backend.request("database.read", ["chats", {chat_id: params.chat_id}, "!meta", "members"]);

        if (!Object.keys(members?.members || {}).length) {
            fail("database/invalid-argument", "Expected members in the chat.");
        }
        await this.backend.request("notification.send", {userId: uid, data}, {});
    }

    async onDelete({params, value}) {
        return;
        console.debug("[Backend:Chat]", `deleted [${params.chat_id}/${params.message_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        return;
        console.debug("[Backend:Chat]", `updated [${params.chat_id}/${params.message_id}]`, {params, previous, value});
    }
}
