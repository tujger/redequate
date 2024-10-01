import React from "react";
import {Card} from "@mui/material";
import {CardHeader} from "@mui/material";
import {ListItem} from "@mui/material";
import PropTypes from "prop-types";

const ServiceComponent = props => {
    const {text} = props;
    return <ListItem alignItems={"flex-start"} disableGutters={true}>
        <Card raised>
            <CardHeader
                subheader={text}
            />
        </Card>
    </ListItem>
};

ServiceComponent.propTypes = {
    text: PropTypes.string,
};

export default ServiceComponent;
