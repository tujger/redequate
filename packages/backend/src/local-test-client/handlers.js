import {fail, identifier} from "../../../common";
import {sendMessage} from "../../../messaging/src/local-test/common";

const isNonEmptyString = value => typeof value === "string" && Boolean(value.trim());

const validate = (args, fields = []) => {
    if (!args || typeof args !== "object" || args instanceof Array) {
        fail("backend/invalid-argument", "Function arguments must be an object.");
    }
    for (const field of fields) {
        if (!isNonEmptyString(args[field])) {
            fail("backend/invalid-argument", `${field} must be a non-empty string.`);
        }
    }
};

const validateNotFound = args => {
    if (args.code !== "NOT_FOUND") {
        fail("backend/invalid-argument", "code must be NOT_FOUND.");
    }
};

const complete = (origin, result) => ({origin, status: "COMPLETE", result});

// Local responses and in-page notification delivery; no remote operations.
export default {
    fixChat: args => {
        console.log("[LocalTestBackendClient] fixChat", args);
        validate(args, ["id"]);
        return complete(args, "Chat fixed");
    },
    fixError: args => {
        console.log("[LocalTestBackendClient] fixError", args);
        validate(args, ["key"]);
        return complete(args, "Error fixed");
    },
    fixMutual: args => {
        console.log("[LocalTestBackendClient] fixMutual", args);
        validate(args, ["uid", "typeId"]);
        if (args.id !== undefined) validate(args, ["id"]);
        return complete(args, "Mutual fixed");
    },
    fixMutualStamp: args => {
        console.log("[LocalTestBackendClient] fixMutualStamp", args);
        validate(args, ["id"]);
        validateNotFound(args);
        if (!isNonEmptyString(args.tag) && !isNonEmptyString(args.uid)) {
            fail("backend/invalid-argument", "tag or uid must be a non-empty string.");
        }
        return complete(args, "Mutual stamp fixed");
    },
    fixPost: args => {
        console.log("[LocalTestBackendClient] fixPost", args);
        validate(args, ["id"]);
        return complete(args, "Post fixed");
    },
    fixTag: args => {
        console.log("[LocalTestBackendClient] fixTag", args);
        validate(args, ["key"]);
        return complete(args, "Tag fixed");
    },
    fixUser: args => {
        console.log("[LocalTestBackendClient] fixUser", args);
        validate(args, ["key"]);
        return complete(args, "Pending fixes, refresh later");
    },
    mutualAction: args => {
        console.log("[LocalTestBackendClient] mutualAction", args);
        validate(args, ["key", "typeId"]);
        if (args.action !== "accept" && args.action !== "reject") {
            fail("backend/invalid-argument", "action must be accept or reject.");
        }
        return {data: {status: "COMPLETE"}};
    },
    sendMail: args => {
        console.log("[LocalTestBackendClient] sendMail", args);
        validate(args, ["from", "to", "subject", "message"]);
        const id = identifier();
        return {
            info: {
                accepted: [args.to],
                rejected: [],
                envelope: {from: args.from, to: [args.to]},
                messageId: `<${id}@local-test.redequate>`,
                response: `250 2.0.0 OK: queued as ${id}`
            }
        };
    },
    sendNotification: args => {
        console.log("[LocalTestBackendClient] sendNotification", args);
        validate(args, ["body"]);
        if (args.uid !== undefined && !isNonEmptyString(args.uid)) {
            fail("backend/invalid-argument", "uid must be a non-empty string.");
        }
        let tokens = [];
        if (args.to !== undefined) {
            tokens = args.to instanceof Array ? [...args.to] : [args.to];
            if (!tokens.length || !tokens.every(isNonEmptyString)) {
                fail("backend/invalid-argument", "to must be a non-empty string or an array of non-empty strings.");
            }
        }
        if (args.uid === undefined && !tokens.length) {
            fail("backend/invalid-argument", "A uid or to recipient is required.");
        }
        const results = tokens.map(token => ({token, messageId: identifier()}));
        sendMessage({
            title: args.title,
            body: args.body,
            from: args.from,
            priority: args.priority,
            tag: args.tag,
            image: args.image ?? args.icon
        });
        return results;
    }
};
