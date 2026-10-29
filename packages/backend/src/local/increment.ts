import {fail} from "../../../common";

const INCREMENT = Symbol("LocalBackend.increment");

export type IncrementValue = {[INCREMENT]: number};

export const isIncrement = (value: unknown): value is IncrementValue =>
    value !== null && typeof value === "object" && Object.hasOwn(value, INCREMENT) &&
    typeof (value as IncrementValue)[INCREMENT] === "number" && Number.isFinite((value as IncrementValue)[INCREMENT]);

export const incrementDelta = (value: IncrementValue): number => {
    if (!isIncrement(value)) fail("database/invalid-argument", "Expected an increment value.");
    return value[INCREMENT];
};

export default function increment(n: number): IncrementValue {
    if (typeof n !== "number" || !Number.isFinite(n)) {
        fail("database/invalid-argument", "increment requires a finite number.");
    }
    return {[INCREMENT]: n};
}
