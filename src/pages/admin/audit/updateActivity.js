export default async ({database, uid = 0, type = null, details = null}) => {
    database.create(["activity", "activity_id"], {
        details,
        timestamp: database.TIMESTAMP,
        type,
        uid,
    }).catch(console.error)
}
2
