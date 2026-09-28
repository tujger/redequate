import React from "react";
import PropTypes from "prop-types";
import styles from "./styles/ServiceComponent.module.css";

const ServiceComponent = props => {
    const {text} = props;
    return <div className={styles.item}>
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.subheader}>{text}</div>
            </div>
        </div>
    </div>
};

ServiceComponent.propTypes = {
    text: PropTypes.string,
};

export default ServiceComponent;
