import React from "react";
import {connect} from "react-redux"
import ConfirmComponent from "./ConfirmComponent";

const DispatchedConfirmComponent = (
    {
        open,
        ...props
    }) => {

    if (!open) return null;
    return <ConfirmComponent {...props}/>
}

const mapStateToProps = ({confirmComponentReducer}) => ({
    ...confirmComponentReducer.props
});

export default connect(mapStateToProps)(DispatchedConfirmComponent);
