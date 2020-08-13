export const toDateString = (millis) => {
    const now = new Date();
    const given = new Date(millis);

    const dateString = given.toLocaleDateString();
    const timeString = given.toLocaleTimeString().replace(/^.*?\s\d/, "").replace(/:\d+\s/, " ");

    if((now.getFullYear() !== given.getFullYear())
        || (now.getMonth() !== given.getMonth())
        || (now.getDate() !== given.getDate())) {
        return dateString + " " + timeString;
    } else {
        return timeString;
    }
}
