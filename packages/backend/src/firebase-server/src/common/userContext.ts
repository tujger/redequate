import {AsyncLocalStorage} from "node:async_hooks";

// Each callable or database event owns its asynchronous user context.
export default new AsyncLocalStorage<string | undefined>();
