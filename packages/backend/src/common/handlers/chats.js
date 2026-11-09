import {fail} from "../../../../common";
import BackendListener from "../BackendListener";

export default class ChatListener extends BackendListener {
    constructor(backend) {
        super(["chats", "chat_id", "message_id"], backend);
    }

    async onCreate({params, value}) {
        if (params.message_id === "!meta" || typeof value?.uid !== "string" || !value.uid) return;
        console.debug("[Backend:Chat]", `created [${params.chat_id}/${params.message_id}]`, {params, value});

        const {text = "", uid} = value;
        const senderName = await this.backend.request("database.read", ["users_public", {user_id: uid}, {name: "name"}]);

        const data = {
            body: `${senderName}: ${text}`.replace(/\$\[.*?:.*?:(.*?)]/g, "$1"),
            tag: this.backend.projectUrl + "/chat/" + uid,
            type: "chat",
        };

        const members = await this.backend.request("database.read", ["chats", {chat_id: params.chat_id}, {message_id: "!meta"}, {members: "members"}]);
        if (!Object.keys(members || {}).length) {
            fail("database/invalid-argument", "Expected members in the chat.");
        }
        for (const userId of Object.keys(members)) {
            if (userId === uid) continue;
            const active = await this.backend.request("database.read", ["_chats", {user_id: userId}, {chat_id: params.chat_id}]);
            if (active == null) continue;
            await this.backend.request("notification.send", {userId, data});
        }
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
