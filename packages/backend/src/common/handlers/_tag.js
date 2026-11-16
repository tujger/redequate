import update from "../../../../database/src/common/methods/update";
import BackendListener from "../BackendListener";
import {registerError} from "./utils";

export default class _TagListener extends BackendListener {
    constructor(backend) {
        super(["_tag", "tag_id", "post_id"], backend);
    }

    async onCreate({params, value}) {
        console.debug("[Backend:_Tag]", `created [${params.tag_id}/${params.post_id}]`, {params, value});

        const post = await this.backend.request(
            "database.read",
            ["posts", {post_id: params.post_id}]
        );
        if (!post || post.to) return;

        const cursor = await this.backend.request(
            "database.cursor",
            ["mutual", {mutual_type: "watching"}, "mutual_id"],
            {
                equalTo: params.tag_id,
                orderBy: ["id"],
            }
        );

        // while (!cursor.position.finished) {
        await cursor.next(1000).then(async records => {
            for (const {value: subscription} of records) {
                try {
                    for (const type of ["watching", "_"]) {
                        await update(
                            this.backend,
                            [
                                "mutualstamps",
                                {mutual_type: type},
                                {user_id: subscription.uid},
                                {mutual_id: params.post_id}
                            ],
                            current => {
                                if (!current) return value;
                            }
                        );
                    }
                } catch (error) {
                    await registerError(this.backend, error);
                }
            }
        })
        // }
    }

    async onDelete({params, value}) {
        console.debug("[Backend:_Tag]", `deleted [${params.tag_id}/${params.post_id}]`, {params, value});
    }

    async onUpdate({params, value, previous}) {
        console.debug("[Backend:_Tag]", `updated [${params.tag_id}/${params.post_id}]`, {params, previous, value});
    }
}
