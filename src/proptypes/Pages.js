import PropTypes from "prop-types";
import {Page} from "./Page";

export const Pages = () => {};

Pages.propTypes = {
    auto: PropTypes.objectOf(Page).isRequired,
    about: PropTypes.objectOf(Page),
    chat: PropTypes.objectOf(Page),
    chats: PropTypes.objectOf(Page),
    contacts: PropTypes.objectOf(Page),
    editprofile: PropTypes.objectOf(Page).isRequired,
    home: PropTypes.objectOf(Page).isRequired,
    login: PropTypes.objectOf(Page).isRequired,
    logout: PropTypes.objectOf(Page).isRequired,
    main: PropTypes.objectOf(Page).isRequired,
    profile: PropTypes.objectOf(Page).isRequired,
    restore: PropTypes.objectOf(Page),
    search: PropTypes.objectOf(Page),
    signup: PropTypes.objectOf(Page).isRequired,
    signupFinish: PropTypes.objectOf(Page).isRequired,
    user: PropTypes.objectOf(Page).isRequired,

    // generic admin cases
    adduser: PropTypes.objectOf(Page).isRequired,
    settings: PropTypes.objectOf(Page).isRequired,
    edituser: PropTypes.objectOf(Page).isRequired,
    users: PropTypes.objectOf(Page).isRequired,

    notfound: PropTypes.objectOf(Page).isRequired,
}
