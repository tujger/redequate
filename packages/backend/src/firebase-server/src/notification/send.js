import {HttpsError, onCall} from "firebase-functions/v2/https";
import authorize from "../common/authorize.js";

export default onCall(async request => {
    const {data} = request;
    try {
        const {database, messaging, url} = await import("../common/firebase");
        await authorize(request, database, {adminOnly: true});
        let tokens = [];
        let uidTokens = [];
        if (data.uid) {
            try {
                let ref = database.ref("users_private").child(data.uid);
                let snapshot = await ref.once("value");
                let val = snapshot.val();
                if (val) {
                    for (let device in val) {
                        if (val[device] && val[device].notification) {
                            val[device].deviceId = device;
                            uidTokens.push(val[device]);
                            tokens.push(val[device].notification);
                        }
                    }
                }
            } catch (e) {
                console.log("ErrSendNotification", e);
            }
        }
        if (data.to && data.to instanceof Array) {
            for (let item of data.to) {
                tokens.push(item);
            }
        } else if (data.to) {
            tokens.push(data.to);
        }

        let payload = {
            data: {
                body: data.body,
                icon: url + "/logo-192.png",
                tag: url,
                title: "TITTLE",
            },
        };

        let options = {};
        if (data.priority) options.priority = data.priority;

        const results = await sendToTokens(messaging, tokens, payload, options);
        let toRemove = [];
        for (let result of results) {
            const {token, expired} = result;
            const device = uidTokens.filter(item => item.notification === token)[0];
            if (device) {
                const {deviceType, osName, osVersion, browserName} = device;
                result.deviceType = deviceType;
                result.osName = osName;
                result.osVersion = osVersion;
                result.browserName = browserName;
                if (expired) toRemove.push(device);
            }
        }
        if (toRemove.length) {
            console.log("Tokens to remove", toRemove);
            console.log("UidTokens", uidTokens);
        }
        return results;
    } catch (error) {
        console.log("ErrSendNotification", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message, {
            // "some-key": "some-value"
        })
    }
});

export const sendToTokens = async (messaging, tokens, payload, options = {}) => {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        console.info("[Emulator] Push", {tokens, payload, options});
        return tokens.map((token, index) => ({token, messageId: `emulator-${index}`}));
    }
    const results = [];
    const data = Object.fromEntries(Object.entries(payload.data || {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]));
    for (let offset = 0; offset < tokens.length; offset += 500) {
        const batch = tokens.slice(offset, offset + 500);
        const response = await messaging.sendEachForMulticast({
            tokens: batch,
            data,
            ...(options.priority ? {
                android: {priority: options.priority},
                webpush: {headers: {Urgency: options.priority === "high" ? "high" : "normal"}},
            } : {}),
        });
        response.responses.forEach(({messageId, error}, index) => {
            if (error) {
                const info = error.toJSON();
                const expired = ["messaging/invalid-registration-token",
                    "messaging/registration-token-not-registered"].includes(error.code);
                results.push({token: batch[index], error: info, ...(expired ? {expired: true} : {})});
            } else {
                results.push({token: batch[index], messageId});
            }
        });
    }
    return results;
};
