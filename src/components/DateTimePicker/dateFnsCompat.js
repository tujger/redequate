const dateFns = require("date-fns");
const isValidModule = require("date-fns/isValid");

if (typeof dateFns.isValid !== "function" && typeof isValidModule.isValid === "function") {
    dateFns.isValid = isValidModule.isValid;
}

module.exports = dateFns;
