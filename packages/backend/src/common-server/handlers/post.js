export default {
    path: ["posts", "post_id"],
    onWrite(props) {
        console.log("--------------------------------")
        console.log("[POST]WRITE", props);
        console.log("================================")
    },
};
