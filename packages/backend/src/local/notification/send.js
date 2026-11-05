import {fail} from "../../../../common";
import {readToken} from "../../../../messaging/src/local/database";
import {sendMessage} from "../../../../messaging/src/local/common";

export default async ({storageId, backend, args: [payload]}) => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        typeof payload.userId !== "string" || !payload.userId.trim()) {
        fail("backend/invalid-argument", "notification.send requires an object with a non-empty userId.");
    }
    const devices = await backend.request("database.read", ["users_private", {user_id: payload.userId}, {device: "device"}]);
    const tokens = Object.values(devices || {}).map(device => device?.notification).filter(Boolean);
    if (!tokens.length) return [];
    const data = {
        icon: backend.projectUrl + "/logo-192.png",
        title: backend.projectTitle,
        ...payload.data,
    };
    const subscribedToken = await readToken(storageId);
    return tokens.map(token => {
        if (subscribedToken && token === subscribedToken) {
            sendMessage(data, storageId);
            return {token, messageId: `local-${token}`};
        }
        return {token, error: {code: "messaging/registration-token-not-registered"}, expired: true};
    });
};
