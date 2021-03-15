import Pagination from "../../../controllers/FirebasePagination";
import {normalizeSortName} from "../../../controllers/UserData";

export default function({start}) {
    // eslint-disable-next-line one-var
    let count = 0, countTotal = 0, finished = false, started = true, names = [], emails = [];
    const order = "asc";
    const added = [];

    const maxItems = 25;

    const namesPagination = new Pagination({
        child: "_sort_name",
        ref: "users_public",
        size: maxItems,
        start: normalizeSortName(start),
    });

    const emailsPagination = new Pagination({
        child: "email",
        ref: "users_public",
        size: maxItems,
        start: start,
    });

    const next = async () => {
        started = true;

        names = await namesPagination.next();
        if (start) emails = await emailsPagination.next();
        else emails = [];

        const result = [];
        if (names.length) {
            names.forEach(item => {
                if (added.indexOf(item.key) >= 0) return;
                result.push(item);
                added.push(item.key);
            })
        }
        if (emails.length) {
            emails.forEach(item => {
                if (added.indexOf(item.key) >= 0) return;
                result.push(item);
                added.push(item.key);
            })
        }

        finished = namesPagination.finished && (start ? emailsPagination.finished : true);
        count = result.length;
        countTotal = added.length;
        return result;
    }

    const reset = async () => {
        // firebase.database().goOnline();
        namesPagination.reset();
        emailsPagination.reset();
        countTotal = 0;
        count = 0;
        finished = false;
        started = false;
    }

    return {
        get count() {
            return count
        },
        get countTotal() {
            return countTotal
        },
        get finished() {
            return finished
        },
        get order() {
            return order;
        },
        get started() {
            return started
        },
        get term() {
            return `users|${start}`;
        },
        next: next,
        reset: reset,
    };
}
