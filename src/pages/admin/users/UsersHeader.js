import React from "react";
import NavigationToolbar from "../../../components/NavigationToolbar";
import Select from "../../../controls/Select/Select";
import TextField from "../../../controls/TextField/TextField";

export default ({filter, handleChange, mode}) => {
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

    const input = mode === "all" && <TextField
        autoFocus
        onChange={handleChange("filter")}
        placeholder={"Search"}
        value={filter}
    />;

    return <NavigationToolbar backButton={null}>
        {select}
        {input}
    </NavigationToolbar>
}
