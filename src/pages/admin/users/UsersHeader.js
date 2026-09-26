import React from "react";
import Clear from "@material-ui/icons/Clear";
import NavigationToolbar from "../../../components/NavigationToolbar";
import Select from "../../../components/Select/Select";
import baseStyles from "../../../themes/Base.module.css";
import headerStyles from "./styles/UsersHeader.module.css";

// eslint-disable-next-line react/prop-types
export default ({classes: givenClasses, filter, handleChange, mode}) => {
    const classes = {...givenClasses, ...headerStyles};
    const options = [
        {label: "All users", value: "all"},
        {label: "Administrators", value: "admins"},
        {label: "Disabled users", value: "disabled"},
        {label: "Recently active", value: "active"},
        {label: "Recently registered", value: "recent"},
        {label: "Users not verified", value: "notVerified"},
    ];

    const select = <Select
        onChange={handleChange("mode")}
        options={options}
        value={mode}
    />;

    const input = mode === "all" && <div className={classes.inputWrapper}>
        <input
            autoFocus
            className={classes.input}
            onChange={handleChange("filter")}
            placeholder='Search'
            value={filter}
        />
        {filter && <button
            aria-label='Clear'
            className={[classes.clearButton, baseStyles.ripple].join(" ")}
            onClick={handleChange("clear")}
            title='Clear'
            type='button'
        >
            <Clear/>
        </button>}
    </div>;

    return <>
        <div className={classes.desktopOnly}>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
            >
                {select}
                {input}
            </NavigationToolbar>
        </div>
        <div className={classes.mobileOnly}>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
                rightButton={select}
            >
                {input}
            </NavigationToolbar>
        </div>
    </>
}
