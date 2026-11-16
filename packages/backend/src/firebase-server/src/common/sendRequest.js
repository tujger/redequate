import {HttpsError} from "firebase-functions/v2/https";

export default async function sendRequest(props) {
    const {url, method, headers, body} = props;
    // Forward the caller's token in the URL so Security Rules remain authoritative.
    const response = await fetch(url, {
        method,
        ...(headers === undefined ? {} : {headers}),
        ...(body === undefined ? {} : {body}),
        signal: AbortSignal.timeout(30000),
        redirect: "error",
    }).catch(error => {
        throw new HttpsError(error.name === "TimeoutError" ? "deadline-exceeded" : "unavailable", "Database request failed.");
    });
    return {...props, response};
}
