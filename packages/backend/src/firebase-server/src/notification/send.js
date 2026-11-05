import {database, messaging} from "../common/firebase";

const sendToUserDevices = async (backend, {userId, data, options = {}}) => {
    const tokens = [];
    const devices = await backend.request("database.read", ["users_private", {user_id: userId}, "device"]);
    console.debug("[Backend:Notification]", "send to devices", {userId, data, devices});
    for (const device of Object.values(devices || {})) {
        if (device?.notification) {
            tokens.push(device.notification);
        }
    }
    const results = await sendToTokens(messaging, tokens, {data}, options);
    await parseNotificationsResults(backend, devices, results)
}

const sendToTokens = async (backend, tokens, payload, options = {}) => {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        console.log("[Backend:Notification] push", {tokens, payload, options});
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
}

const parseNotificationsResults = async (backend, devices, results) => {
    console.info("[Backend:Notification] RESULTS", {devices, results});

    const toRemove = results.filter(({expired}) => !!expired);
    console.info("[Backend:Notification] TOREMOVE", toRemove);
}

export default function sendNotification(payload) {
    const {data, ...rest} = payload;
    const updated = {
        icon: this.projectUrl + "/logo-192.png",
        title: this.projectTitle,
        ...data
    }
    return sendToUserDevices(this, {...rest, data: updated});
}

const oldCallToCheckRemoveUserAccountOnNotificationExpired = async request => {
    const {data} = request;
    let uidTokens = [];
    if (data.uid) {
        let ref = database.ref("users_private").child(data.uid);
        let snapshot = await ref.once("value");
        let val = snapshot.val();
        if (val) {
            for (let device in val) {
                if (val[device] && val[device].notification) {
                    uidTokens.push(val[device]);
                }
            }
        }
    }

    const results = await sendToTokens();
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
}
