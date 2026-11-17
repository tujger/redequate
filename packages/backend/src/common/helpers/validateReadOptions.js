import {validateShallowRead} from "../../../../database/src/common/helpers/shallowRead";
import {fail} from "../../../../common";
import {readQueryOptions} from "../../../../database/src/common/helpers/applyReadOptions";

export default options => {
    validateShallowRead(options);
    if (!options || typeof options !== "object" || Array.isArray(options) ||
        Object.keys(options).some(key => !["orderBy", "equalTo", "shallow"].includes(key))) {
        fail("database/invalid-argument", "Expected read options {orderBy, equalTo, shallow}.");
    }
    return readQueryOptions(options);
};
