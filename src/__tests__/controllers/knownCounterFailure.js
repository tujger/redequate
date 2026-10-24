// Default mode preserves reproducible known defects without breaking unrelated CI.
// COUNTER_AUDIT_STRICT=1 turns them into ordinary failing acceptance tests.
export const knownCounterFailure = process.env.COUNTER_AUDIT_STRICT === "1" ? it : it.fails;
