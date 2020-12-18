import {matchRole, useCurrentUserData} from "./UserData";
import {usePages} from "./General";

export default function PagesPagination({start, size = 10}) {
    const currentUserData = useCurrentUserData();
    const pages = usePages();

    const pagesFlat = Object.keys(pages).map(key => pages[key]);
    let count = 0, countTotal = 0, finished = false, started = true, order = "asc";

    const next = async () => {
        started = true;

        let result = [];
        if (!finished && start) {
            for (const page of pagesFlat) {
                if (result.length > size) break;
                if (!matchRole(page.roles, currentUserData)) continue;
                if (!page._route) continue;
                if (page._route.indexOf(":") >= 0) continue;

                if (([page.title || "", page.label || "", page.description || ""]
                    .join("\u0000").toLowerCase().indexOf(start)) < 0) continue;
                result.push({
                    key: page._route + page.label + page.title,
                    value: {
                        route: page.route,
                        name: page.label || page.title
                    }
                })
            }
        }
        finished = result.length < size;
        count = result.length;
        countTotal = countTotal + count;
        return result;
    }

    const reset = async () => {
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
        next: next,
        reset: reset,
    };
}
