import React from "react";
import {DeviceUUID} from "device-uuid";

export const fetchDeviceId = () => {
    if (!localStorage.getItem("device_id")) {
        const uuid = new DeviceUUID().get();
        localStorage.setItem("device_id", uuid);
    }
    return localStorage.getItem("device_id");
};
