export * from "./components";
export * from "./controllers";
export * from "./examples";
export * from "./layouts";
export * from "./pages";
export * from "./images";
export {default as Dispatcher} from "./Dispatcher";

const packagejson = require("../package.json");

export const version = packagejson.version;
