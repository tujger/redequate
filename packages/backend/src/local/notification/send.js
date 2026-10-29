import {readToken} from "../../../../messaging/src/local/database";
import {sendMessage} from "../../../../messaging/src/local/common";

export default async ({storageId, args: [tokens, payload]}) => {
    const subscribedToken = await readToken(storageId);
    return tokens.map(token => {
        if (subscribedToken && token === subscribedToken) {
            sendMessage(payload.data || {}, storageId);
            return {token, messageId: `local-${token}`};
        }
        return {token, error: {code: "messaging/registration-token-not-registered"}, expired: true};
    });
};
