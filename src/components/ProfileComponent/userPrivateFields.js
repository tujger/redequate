import InfoIcon from "@mui/icons-material/Info";
import React from "react";
import Provider from "./Provider";

export default {
    updated: {
        id: "updated",
        label: "",
        icon: <InfoIcon/>,
        editComponent: ({value}) => <div>
            User data updated: {new Date(value).toLocaleString()}
        </div>
    },
    provider: {
        viewComponent: Provider
    }
}
