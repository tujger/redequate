export default function createDatabaseUrl({database, reference, token}) {
    const url = new URL(reference.toString());
    url.pathname += ".json";
    if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
        const databaseUrl = new URL(database.app.options.databaseURL);
        url.searchParams.set("ns", databaseUrl.searchParams.get("ns") ?? databaseUrl.hostname.split(".")[0]);
    }
    if (token) url.searchParams.set("auth", token);
    return url;
}
