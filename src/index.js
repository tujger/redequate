export * from "./chat";
export * from "./components";
export * from "./controllers";
export * from "./images";
export * from "./layouts";
export * from "./pages";
export * from "./proptypes";
export * from "./workers";
export {lazyListReducer} from "./reducers/lazyListReducer";
export {default as Dispatcher} from "./Dispatcher";
export {WebWorker} from "./workers/WebWorker";
export {progressViewReducer} from "./reducers/progressViewReducer";

const packagejson = require("../package.json");

export const version = packagejson.version;
