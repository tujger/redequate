import AddressIcon from "@mui/icons-material/LocationCity";
import NameIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import React from "react";
import PlacesTextField from "../../components/PlacesTextField";
import {TextMaskPhone} from "../../controllers/TextMasks";
import TextField from "../../controls/TextField/TextField";
import styles from "./styles/ProfileComponent.module.css";

export default {
    name: {
        icon: <NameIcon/>,
        id: "name",
        label: "User.Name",
        required: true,
        unique: true,
        viewComponent: ({userData}) => <h6 className={styles.name}>{userData.name}</h6>
    },
    created: {
        id: "created",
        label: "User.Date since",
        editComponent: null,
        viewComponent: ({userData}) => <>
            <small className={styles.caption}>Since {userData.created}</small>
            <div className={styles.fieldSpacer}/>
        </>
    },
    address: {
        id: "address",
        label: "User.Address",
        icon: <AddressIcon/>,
        editComponent: <PlacesTextField
            type={"formatted"}
        />
    },
    phone: {
        id: "phone",
        label: "User.Phone",
        icon: <PhoneIcon/>,
        editComponent: <TextField
            inputComponent={TextMaskPhone}
        />
    },
}
