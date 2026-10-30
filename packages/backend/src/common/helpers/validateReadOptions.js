import {fail} from "../../../../common";
import {readQueryOptions} from "../../../../database/src/common/applyReadOptions";

export default options => {
    if (!options || typeof options !== "object" || Array.isArray(options) ||
        Object.keys(options).some(key => !["orderBy", "equalTo"].includes(key))) {
        fail("database/invalid-argument", "Expected read options {orderBy, equalTo}.");
    }
    return readQueryOptions(options);
};
