import {fail} from "../../../common";

export type IncrementValue = {".sv": {increment: number}};

export const isIncrement = (value: unknown): value is IncrementValue => {
    if (value === null || typeof value !== "object" || Object.keys(value).length !== 1) return false;
    const serverValue = (value as Record<string, unknown>)[".sv"];
    if (serverValue === null || typeof serverValue !== "object" || Object.keys(serverValue).length !== 1) return false;
    const n = (serverValue as Record<string, unknown>).increment;
    return typeof n === "number" && Number.isFinite(n);
};

export default function increment(n: number): IncrementValue {
    if (typeof n !== "number" || !Number.isFinite(n)) {
        fail("database/invalid-argument", "increment requires a finite number.");
    }
    return {".sv": {increment: n}};
}
