import BackendListener from "../BackendListener";

export default class ChatListener extends BackendListener {
    constructor(backend) {
        super(["chats", "chat_id","message_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Chat]", `created [${params.chat_id}/${params.message_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:Chat]", `deleted [${params.chat_id}/${params.message_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:Chat]", `updated [${params.chat_id}/${params.message_id}]`, {params, previous, value});
    }
}
