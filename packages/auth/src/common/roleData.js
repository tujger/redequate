export function encodeRole(database, userId, role) {
    return database.supportsScalarRecords === false && role != null ? {user_id: userId, role} : role;
}

export function decodeRole(database, value) {
    return database.supportsScalarRecords === false && value != null ? value.role : value;
}

export function roleQuery(database, role) {
    return database.supportsScalarRecords === false ? {orderBy: "role", equalTo: role} : {equalTo: role};
}
