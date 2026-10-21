// Firebase orders all object/array nodes equally; their child keys break ties.
const rank = value => value == null
    ? 0
    : typeof value === "boolean"
        ? 1
        : typeof value === "number" ? 2 : typeof value === "string" ? 3 : 4;
export default function compareValues(left, right) {
    const difference = rank(left) - rank(right);
    if (difference) return difference;
    if (rank(left) === 4) return 0;
    return left < right ? -1 : left > right ? 1 : 0;
}
