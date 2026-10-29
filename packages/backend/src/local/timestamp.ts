const TIMESTAMP = Symbol("LocalBackend.TIMESTAMP");
const timestamp = Object.freeze({[TIMESTAMP]: true as const});

export const isTimestamp = (value: unknown): value is typeof timestamp =>
    value !== null && typeof value === "object" && Object.hasOwn(value, TIMESTAMP) &&
    (value as typeof timestamp)[TIMESTAMP] === true;

export default timestamp;
