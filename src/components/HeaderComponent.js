import React from "react";
import {StickyHeaderComponent} from "../layouts/TopBottomMenuLayout/StickyHeaderComponent"
import MainHeader from "../layouts/ResponsiveDrawerLayout/MainHeader";

const HeaderComponent =
    ({
         menuComponent,
         title,
         narrow,
         narrowComponent = <MainHeader title={title} menuComponent={menuComponent}/>,
         wide,
         wideComponent = <StickyHeaderComponent title={title} menuComponent={menuComponent}/>,
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
