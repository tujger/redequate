import {useEffect} from "react";
import {useHistory, useLocation} from "react-router-dom";
import {usePages} from "./General";
import {useCurrentUserDataValue} from "./useCurrentUserData";

export function useRedirectToLogin() {
    const currentUserData = useCurrentUserDataValue();
    const history = useHistory();
    const {pathname} = useLocation();
    const pages = usePages();

    const loginRoute = pages.login.route;
    const shouldRedirect = !currentUserData.id;

    useEffect(() => {
        if (shouldRedirect && pathname !== loginRoute && history.location.pathname !== loginRoute) {
            history.replace(loginRoute);
        }
    }, [shouldRedirect, pathname, loginRoute, history]);

    return shouldRedirect;
}
