import PropTypes from "prop-types";

export const Page = () => {};
Page.propTypes = {
    adornment: () => {},
    component: PropTypes.element,
    daemon: PropTypes.bool,
    disabled: PropTypes.bool,
    icon: PropTypes.element,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func,
    pullToRefresh: PropTypes.bool,
    roles: PropTypes.arrayOf(PropTypes.string),
    route: PropTypes.string.isRequired,
}
