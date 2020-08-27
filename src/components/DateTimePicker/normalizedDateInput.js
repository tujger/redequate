import moment from "moment";

export const normalizeDateInput = (date) => {
    if (date) {
        if (date instanceof Date) {
            return moment(date);
        }
        return date;
    }
    return null;
}
