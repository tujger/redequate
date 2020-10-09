import React from "react";
import Clear from "@material-ui/icons/Clear";
import IconButton from "@material-ui/core/IconButton";
import Input from "@material-ui/core/Input";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Hidden from "@material-ui/core/Hidden";
import NavigationToolbar from "../../../components/NavigationToolbar";

export default ({classes, filter, handleChange, mode}) => {
    return <>
        <Hidden smDown>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
            >
                <Select
                    color={"secondary"}
                    onChange={handleChange("mode")}
                    value={mode}
                >
                    <MenuItem value={"all"}>All users</MenuItem>
                    <MenuItem value={"admins"}>Administrators</MenuItem>
                    <MenuItem value={"disabled"}>Disabled users</MenuItem>
                    <MenuItem value={"notVerified"}>Users not verified</MenuItem>
                </Select>
                {mode === "all" && <Input
                    autoFocus
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={handleChange("clear")}
                        size={"small"}
                        title={"Clear"}
                        variant={"text"}
                    /> : null}
                    onChange={handleChange("filter")}
                    placeholder={"Search"}
                    value={filter}
                />}
            </NavigationToolbar>
        </Hidden>
        <Hidden mdUp>
            <NavigationToolbar
                backButton={null}
                className={classes.topSticky}
                rightButton={<Select
                    color={"secondary"}
                    onChange={handleChange("mode")}
                    value={mode}
                >
                    <MenuItem value={"all"}>All users</MenuItem>
                    <MenuItem value={"admins"}>Administrators</MenuItem>
                    <MenuItem value={"disabled"}>Disabled users</MenuItem>
                    <MenuItem value={"notVerified"}>Users not verified</MenuItem>
                </Select>}
            >
                {mode === "all" && <Input
                    autoFocus
                    color={"secondary"}
                    endAdornment={filter ? <IconButton
                        children={<Clear/>}
                        onClick={handleChange("clear")}
                        size={"small"}
                        title={"Clear"}
                        variant={"text"}
                    /> : null}
                    onChange={handleChange("filter")}
                    placeholder={"Search"}
                    value={filter}
                />}
            </NavigationToolbar>
        </Hidden>
    </>
}
