import moment from "moment";

export default (date) => {
    if (date) {
        if (date instanceof Date) {
            return moment(date);
        }
        return date;
    }
    return null;
}
