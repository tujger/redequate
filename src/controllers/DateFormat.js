export const toDateString = (millis) => {
    const now = new Date();
    const given = new Date(millis);

    if((now.getUTCFullYear() !== given.getUTCFullYear())
        || (now.getUTCMonth() !== given.getUTCMonth())
        || (now.getUTCDate() !== given.getUTCDate())) {
        return given.toLocaleDateString();
    } else {
        return given.toLocaleTimeString().replace(/^.*?\s\d/, "").replace(/:\d+\s/, " ");
    }

    return new Date(millis).toDateString();

    var res = "";
    var delta = parseInt(millis/1000);

    var secInDay = 24 * 60 * 60;
    var secInHour = 24 * 60;
    var secInMinute = 60;

    var d = parseInt(delta / secInDay);
    delta -= d * secInDay;

    var h = parseInt(delta / secInHour);
    delta -= h * secInHour;

    var m = parseInt(delta / secInMinute);
    var s = delta - m * secInMinute;

    if(d) {
        res += d + "d";
    }
    if(h) {
        if(res) res += " ";
        res += h + "h";
    }
    if(m) {
        if(res) res += " ";
        res += m + "m";
    }
    if(res) res += " ";
    res += (s ? s : "0") + "s";
    return res;
}
