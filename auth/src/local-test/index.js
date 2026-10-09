import AuthBase from "../AuthBase";

// Test-only Auth scaffold; not intended for production.
// TODO: Implement localStorage or IndexedDB persistence.
export default class LocalTestAuth extends AuthBase {
    constructor(...args) {
        super();
        // TODO: Use implementation-specific arguments when implementing LocalTestAuth.
    }
}
