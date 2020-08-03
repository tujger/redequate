export * from "./components";
export * from "./controllers";
export * from "./layouts";
export * from "./pages";
export * from "./images";
export * from "./chat";
export {default as Dispatcher} from "./Dispatcher";

const packagejson = require("../package.json");

export const version = packagejson.version;
