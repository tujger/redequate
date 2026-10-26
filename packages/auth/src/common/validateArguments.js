import {fail} from "../../../common";

const invalid = message => fail("auth/invalid-argument", message);
export const isRecord = value => value !== null && typeof value === "object" && !(value instanceof Array);

export const validateString = (value, name) => {
    if (typeof value !== "string") invalid(`${name} must be a string.`);
};

export const validateOptions = options => {
    if (options !== undefined && !isRecord(options)) invalid("Options must be an object.");
};

export const validateEmailOptions = options => {
    validateOptions(options);
    if (options?.url !== undefined) validateString(options.url, "url");
    if (options?.handleCodeInApp !== undefined && typeof options.handleCodeInApp !== "boolean") {
        invalid("handleCodeInApp must be a boolean.");
    }
};

export const validateProvider = (provider, name) => {
    if (typeof provider !== "string" && !isRecord(provider)) invalid(`${name} must be a string or an object.`);
};

export const validateProviderOptions = options => {
    validateOptions(options);
    if (options?.scopes !== undefined && (!(options.scopes instanceof Array) || options.scopes.some(scope => typeof scope !== "string"))) {
        invalid("scopes must be an array of strings.");
    }
    if (options?.parameters !== undefined && (!isRecord(options.parameters) || Object.values(options.parameters).some(value => typeof value !== "string"))) {
        invalid("parameters must contain string values.");
    }
};

export const validateCurrentUserOptions = options => {
    validateOptions(options);
    if (options?.skipDelay !== undefined && typeof options.skipDelay !== "boolean") invalid("skipDelay must be a boolean.");
};

export const validateCallbacks = (callback, onError) => {
    if (!(callback instanceof Function) || (onError !== undefined && !(onError instanceof Function))) {
        invalid("Auth state listeners must be functions.");
    }
};

export const validateProfile = fields => {
    if (!isRecord(fields)) invalid("Profile fields must be an object.");
    for (const section of [fields.public, fields.private]) {
        if (section !== undefined && !isRecord(section)) invalid("Public and private profile sections must be objects.");
    }
    if (fields.role !== undefined && fields.role !== null && typeof fields.role !== "string") {
        invalid("Profile role must be a string or null.");
    }
};

export const validateConstructorOptions = options => {
    validateOptions(options);
    if (options?.database !== undefined && !isRecord(options.database)) invalid("database must be an object.");
    if (options?.storageId !== undefined) validateString(options.storageId, "storageId");
    if (options?.UserData !== undefined) {
        try {
            Reflect.construct(Object, [], options.UserData);
        } catch {
            invalid("UserData must be a constructor.");
        }
    }
};
