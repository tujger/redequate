import {baseRules, resolveRules} from "../../firebase/rules.mjs";

it("loads composed production Rules and preserves real REST access, validation and index behavior", async () => {
    const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const project = process.env.GCLOUD_PROJECT;
    if (!/^127\.0\.0\.1:\d+$/.test(host) || !/^127\.0\.0\.1:\d+$/.test(authHost) || !project?.startsWith("demo-")) {
        throw Error("Rules integration requires isolated loopback demo emulators");
    }
    const request = async (path, method = "GET", value, token = "owner", query = {}) => {
        const url = new URL(`http://${host}/${path}.json`);
        url.searchParams.set("ns", `${project}-default-rtdb`);
        if (token && token !== "owner") url.searchParams.set("auth", token);
        for (const [name, field] of Object.entries(query)) url.searchParams.set(name, JSON.stringify(field));
        const response = await fetch(url, {
            method,
            headers: token === "owner" ? {Authorization: "Bearer owner"} : {},
            body: value === undefined ? undefined : JSON.stringify(value),
            signal: AbortSignal.timeout(10000)
        });
        return {status: response.status, body: await response.json()};
    };
    const prior = await request(".settings/rules");
    expect(prior.status).toBe(200);
    const savedRules = typeof prior.body === "string" ? JSON.parse(prior.body) : prior.body;
    const users = {};
    for (const actor of ["A", "B", "Admin"]) {
        const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-rules`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({returnSecureToken: true})
        });
        users[actor] = await response.json();
        expect(users[actor].idToken).toBeTruthy();
    }
    const uid = users.A.localId;
    const admin = users.Admin.localId;
    const paths = [
        [`alerts/${uid}/alert1`, "self", "self"],
        ["chats/rules-test/message1", "all", "all"],
        ["chats/rules-test/!meta", "all", "all"],
        [`mutualstamps/follows/${uid}/mutual1`, "self", "admin"],
        [`mutualstamps/_my/${uid}/mutual1`, "auth", "admin"],
        ["_tag/rules-test/post1", "all", "admin"]
    ];
    const allowed = (policy, actor) => actor === "Admin" || policy === "all" ||
        (policy === "self" && actor === "A") || (policy === "auth" && actor !== "anonymous");
    const results = [];
    try {
        expect((await request(`roles/${admin}`, "PUT", "admin")).status).toBe(200);
        const compositions = [resolveRules(baseRules), resolveRules(baseRules, {
            additions: {posts: {".indexOn": ["created"]}, rule_validation: {$id: {".validate": "newData.isString()"}}}
        })];
        for (const rules of compositions) {
            expect((await request(".settings/rules", "PUT", rules)).status).toBe(200);
            const rows = [];
            for (const [path, read, write] of paths) {
                for (const actor of ["anonymous", "A", "B", "Admin"]) {
                    for (const operation of ["read", "create", "update", "delete"]) {
                        await request(path, "PUT", {x: 1});
                        if (operation === "create") await request(path, "DELETE");
                        const old = (await request(path)).body;
                        const token = users[actor]?.idToken ?? null;
                        const response = await request(path, {read: "GET", create: "PUT", update: "PATCH", delete: "DELETE"}[operation],
                            {create: {x: 2}, update: {y: 2}}[operation], token);
                        const permitted = allowed(operation === "read" ? read : write, actor);
                        expect(response.status, `${actor} ${operation} ${path}`).toBe(permitted ? 200 : 401);
                        const current = (await request(path)).body;
                        expect(current).toEqual(!permitted || operation === "read"
                            ? old
                            : operation === "delete" ? null : operation === "create" ? {x: 2} : {x: 1, y: 2});
                        rows.push({response, current});
                    }
                }
            }
            await request(`alerts/${uid}`, "PUT", {a: {timestamp: 2}, b: {timestamp: 1}});
            const query = await request(`alerts/${uid}`, "GET", undefined, users.A.idToken, {orderBy: "timestamp", equalTo: 1});
            expect(query).toEqual({status: 200, body: {b: {timestamp: 1}}});
            for (const value of [null, "text", 42, true, {nested: {x: 1}}]) {
                expect((await request(`alerts/${uid}/a`, "PUT", value, users.A.idToken)).status).toBe(200);
            }
            results.push(rows);
        }
        expect(results[0]).toEqual(results[1]);
        const requester = users.A.localId;
        const recipient = users.B.localId;
        const requestPath = "mutualrequests/rules-test/request1";
        const requestValue = {uid: requester, id: recipient, timestamp: 123};
        expect((await request(requestPath, "PUT", requestValue, users.A.idToken)).status).toBe(200);
        expect((await request("mutualrequests/rules-test", "GET", undefined, users.A.idToken,
            {orderBy: "uid", equalTo: requester})).body).toEqual({request1: requestValue});
        expect((await request("mutualrequests/rules-test", "GET", undefined, users.B.idToken,
            {orderBy: "id", equalTo: recipient})).body).toEqual({request1: requestValue});
        expect((await request(requestPath, "PATCH", {accepted: true}, users.B.idToken)).status).toBe(200);
        expect((await request(requestPath, "PATCH", {uid: recipient}, users.B.idToken)).status).toBe(401);
        expect((await request(requestPath)).body).toEqual({...requestValue, accepted: true});
        // Admin grants write access but does not bypass .validate when using an ID token.
        expect((await request("rule_validation/check", "PUT", "valid", users.Admin.idToken)).status).toBe(200);
        expect((await request("rule_validation/check", "PUT", 7, users.Admin.idToken)).status).toBe(401);
        expect((await request("rule_validation/check", "DELETE", undefined, users.Admin.idToken)).status).toBe(200);
        await request("posts/rules-index", "PUT", {created: 123});
        expect((await request("posts", "GET", undefined, users.Admin.idToken, {orderBy: "created", equalTo: 123})).body)
            .toEqual({"rules-index": {created: 123}});
    } finally {
        for (const path of [`alerts/${uid}`, "chats/rules-test", `mutualstamps/follows/${uid}`,
            `mutualstamps/_my/${uid}`, "_tag/rules-test", "mutualrequests/rules-test", `roles/${admin}`, "rule_validation", "posts/rules-index"]) {
            await request(path, "DELETE");
        }
        expect((await request(".settings/rules", "PUT", savedRules)).status).toBe(200);
    }
}, 30000);
