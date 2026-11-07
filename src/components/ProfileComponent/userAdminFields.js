import RoleIcon from "@mui/icons-material/Security";
import React from "react";
import {UserRole} from "../../controllers/UserData";
import Select from "../../controls/Select/Select";
import Provider from "./Provider";
import styles from "./styles/ProfileComponent.module.css";

export default {
    role: {
        id: "role",
        label: "Role",
        icon: <RoleIcon/>,
        editComponent: props => <label className={styles.roleField}>
            <span className={styles.roleLabel} id={"profile-role-label"}>Role</span>
            <Select
                aria-labelledby={"profile-role-label"}
                className={styles.roleSelect}
                disabled={props.disabled}
                onChange={props.onChange}
                options={Object.keys(UserRole).map(key => ({label: key, value: UserRole[key]}))}
                value={props.value}
            />
        </label>
    },
    provider: {
        viewComponent: Provider
    }
}
