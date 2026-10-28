export default {
    path: ["extra", "extra_id"],
    onWrite({value, previous, params}) {
        console.log("[Extra]WRITE", params.extra_id, previous, value);
    },
};
