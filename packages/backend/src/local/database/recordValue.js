export const decodeRecordValue = record => {
    if (record === undefined) return undefined;
    if (record?._encoded !== true || !Object.hasOwn(record, "_value")) {
        throw Object.assign(new Error("Incompatible Local record format; recreate the local database explicitly."), {name: "VersionError"});
    }
    return record._value;
};

export const encodeRecordValue = value => {
    // Project object fields for native indexes, including indexes declared later.
    // Keep a separate copy so identity fields never change the original value.
    const record = value !== null && typeof value === "object" && !Array.isArray(value)
        ? structuredClone(value) : {};
    delete record._id;
    record._encoded = true;
    record._value = value;
    return record;
};
