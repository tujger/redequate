import React from "react";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import ListItem from "@material-ui/core/ListItem";
import PropTypes from "prop-types";

const ServiceComponent = props => {
    const {text} = props;
    return <ListItem alignItems="flex-start" disableGutters={true}>
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
