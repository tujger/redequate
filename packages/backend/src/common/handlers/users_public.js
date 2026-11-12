import update from "../../../../database/src/common/methods/update";
import BackendListener from "../BackendListener";
import {createActivity} from "./activity";

export default class UserListener extends BackendListener {
    constructor(backend) {
        super(["users_public", "user_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:User]", `created [${params.user_id}]`, {params, value});
    }

    async onDelete({params, value}) {
        console.debug("[Backend:User]", `deleted [${params.user_id}]`, {params, value});

        const updates = new Map();
        const cursors = [];

        updates.set(["_counters", {id: params.user_id}], null);
        updates.set(["_chats", {user_id: params.user_id}], null);
        updates.set(["roles", {user_id: params.user_id}], null);
        updates.set(["users_private", {user_id: params.user_id}], null);

        await update(this.backend, updates);

        cursors.push(await this.backend.request("database.cursor", ["posts", "post_id"], {
            orderBy: ["uid"],
            equalTo: params.user_id,
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["extra", "extra_id"], {
            orderBy: ["uid"],
            equalTo: params.user_id,
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["mutual", "mutual_type", "mutual_id"], {
            orderBy: ["uid"],
            equalTo: params.user_id,
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["mutualrequests", "mutual_type", "mutual_id"], {
            orderBy: ["uid"],
            equalTo: params.user_id,
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["mutualrequests", "mutual_type", "mutual_id"], {
            orderBy: ["id"],
            equalTo: params.user_id,
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["mutualstamps", "mutual_type", {user_id: params.user_id}, "mutual_id"], {
            handle: () => null,
        }));
        cursors.push(await this.backend.request("database.cursor", ["mutualstamps", "mutual_type", "user_id", "mutual_id"], {
            equalTo: params.user_id,
            handle: () => null,
        }));

        await Promise.all(cursors.map(cursor => cursor.next(1000)));

        await createActivity(this.backend, {
            type: "user.delete",
            details: {
                uid: params.user_id ?? null,
                public: value,
            },
        });
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:User]", `updated [${params.user_id}]`, {params, previous, value});

        // await createActivity(this.backend, {
        //     type: "user.role.change",
        //     details: {
        //         path: `${value.root ? value.root + "/" : ""}${value.to ? value.to + "/" : ""}${params.post_id}` || null,
        //         postId: params.post_id,
        //         uid: value.uid,
        //     },
        // });
    }
}
