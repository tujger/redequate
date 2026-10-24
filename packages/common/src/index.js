export * from "./UserData.js";
export {default as UserData} from "./UserData.js";
export {UserRole} from "./UserRole.js";

export async function delay(providerName, method) {
    const milliseconds = Math.floor(Math.random() * 2001);
    if (milliseconds > 100) console.debug(`[${providerName}] ${method}: ${milliseconds} ms`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
}

export const fail = (code, message) => {
    throw Object.assign(new Error(message), {code});
};
export const notImplemented = method => {
    throw new Error(`Not implemented: ${method}`);
};
export const identifier = () => {
    const crypto = globalThis.crypto;
    if (crypto?.randomUUID instanceof Function) return crypto.randomUUID();

    const bytes = new Uint8Array(16);
    if (crypto?.getRandomValues instanceof Function) {
        crypto.getRandomValues(bytes);
    } else {
        // Format-compatible fallback without cryptographic randomness.
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const resolvePackage = async (instance, name, loadDefault) => {
    if (instance === undefined) return loadDefault();
    if (instance === null || typeof instance !== "object" || instance instanceof Array) {
        const className = name[0].toUpperCase() + name.slice(1);
        const article = /^[aeiou]/i.test(className) ? "an" : "a";
        throw new Error(`Dispatcher ${name} must be ${article} ${className} instance created with new ${className}(...)`);
    }
    return instance;
};
