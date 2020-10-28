export * from "./alerts";
export * from "./chat";
export * from "./components";
export * from "./controllers";
export * from "./images";
export * from "./layouts";
export * from "./pages";
export * from "./proptypes";
export * from "./workers";
export * from "./components/MutualComponent";

export {default as Dispatcher} from "./Dispatcher";
export {WebWorker} from "./workers/WebWorker";

const packagejson = require("../package.json");

export const version = packagejson.version;
