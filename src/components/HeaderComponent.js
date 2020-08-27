import React from "react";
import {StickyHeaderComponent} from "../layouts/TopBottomMenuLayout/StickyHeaderComponent"
import MainHeader from "../layouts/ResponsiveDrawerLayout/MainHeader";

const HeaderComponent = (
    {
        menuComponent,
        title,
        narrow,
        image,
        narrowComponent = <MainHeader image={image} title={title} menuComponent={menuComponent}/>,
        wide,
        wideComponent = <StickyHeaderComponent image={image} title={title} menuComponent={menuComponent}/>,
    }) => {
    if (narrow && narrowComponent) {
        return narrowComponent;
    }
    if (wide && wideComponent) {
        return wideComponent;
    }
    return <div>NO COMPONENT</div>;
}

export default HeaderComponent;
