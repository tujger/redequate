import BackendListener from "../BackendListener";

export default class AlertListener extends BackendListener {
    constructor(backend) {
        super(["alerts", "user_id", "alert_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:Alert]", `created [${params.user_id}/${params.alert_id}]`, {params, value});
        const suffixes = {
            like: "liked your post",
            posts: "mentioned you",
            replies: "replied to your post",
            subreplies: "replied to your reply",
            request: "invited you",
        };
        if (!Object.hasOwn(suffixes, value.type)) throw new Error(`${value.type} is not defined`);
        let authorName;
        try {
            authorName = await this.backend.request("database.read", ["users_public", {user_id: value.uid}, {name: "name"}]);
        } catch (error) {
            console.error(error);
        }
        const payload = {
            data: {
                body: `${authorName || "Somebody"} ${suffixes[value.type]}`,
                icon: this.backend.projectUrl + "/logo-192.png",
                tag: this.backend.projectUrl + "/alerts/",
                title: this.backend.projectTitle,
                type: "alert",
            }
        };
        const devices = await this.backend.request("database.read", ["users_private", {user_id: params.user_id}]);
        for (const device of Object.values(devices || {})) {
            if (device?.notification) {
                console.debug("[Backend:Alert]", `send [${params.user_id}/${params.alert_id}] to [${device.notification}]`, payload);
                await this.backend.request("notification.send", [device.notification], payload, {});
            }
        }
    }
}

export const createAlert = (backend, userId, alert) => {
    return backend.request("database.create",
        ["alerts", {user_id: userId}, "alert_id"],
        {
            uid: alert.uid || null,
            context: alert.context ?? null,
            id: alert.id,
            message: alert.message ?? null,
            new: true,
            path: alert.path ?? null,
            timestamp: backend.TIMESTAMP,
            type: alert.type,
        },
    );
};
