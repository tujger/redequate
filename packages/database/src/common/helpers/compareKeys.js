// Realtime Database sorts signed 32-bit integer keys before other keys.
// Equal numeric values sort by key length (for example, "2" before "02").
export const integerKey = key => {
    const value = Number(key);
    return /^-?0*\d{1,10}$/.test(key) && value >= -2147483648 && value <= 2147483647
        ? value
        : null;
};

export default function compareKeys(left, right) {
    const a = integerKey(left);
    const b = integerKey(right);
    if (a !== null && b !== null) return a - b || left.length - right.length;
    if (a !== null) return -1;
    if (b !== null) return 1;
    return left < right ? -1 : left > right ? 1 : 0;
}
