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

export const identifier = () => window.crypto.randomUUID();

export const resolvePackage = async (instance, name, loadDefault) => {
    if (instance === undefined) return loadDefault();
    if (instance === null || typeof instance !== "object" || Array.isArray(instance)) {
        const className = name[0].toUpperCase() + name.slice(1);
        const article = /^[aeiou]/i.test(className) ? "an" : "a";
        throw new Error(`Dispatcher ${name} must be ${article} ${className} instance created with new ${className}(...)`);
    }
    return instance;
};
