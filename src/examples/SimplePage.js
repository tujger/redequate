import React from "react";
import PropTypes from "prop-types";

const SimplePage = props => <div>
  <h1>{props.title || "Simple page"}</h1>
  {props.body || "Content of simple page"}
</div>;

SimplePage.propTypes = {
  title: PropTypes.string,
  body: PropTypes.string,
};

export default SimplePage;
