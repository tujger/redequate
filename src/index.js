export * from "./chat";
export * from "./components";
export * from "./controllers";
export * from "./images";
export * from "./layouts";
export * from "./pages";
export * from "./workers";
export {default as Dispatcher} from "./Dispatcher";

const packagejson = require("../package.json");

export const version = packagejson.version;
