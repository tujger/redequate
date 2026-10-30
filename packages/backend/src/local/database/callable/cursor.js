import createCursor from "../../../common/helpers/createCursor";
import LocalCursor from "../../../../../database/src/local/cursor";
import parsePath from "../../../../../database/src/local/parsePath";

export default ({storageId, args, backend}) => createCursor(args,
    (path, options) => new LocalCursor(storageId, path, options, backend), parsePath);
