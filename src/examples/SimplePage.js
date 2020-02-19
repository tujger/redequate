import React from "react";
import PropTypes from "prop-types";

const SimplePage = props => {
  let body = props.body || "Content of simple page";
  if(body instanceof Array) {
    body = "<p>" + body.join("</p>\n<p>") + "</p>";
  }
  return <div>
    <h1>{props.title || "Simple page"}</h1>
    <div dangerouslySetInnerHTML={{__html: body}}/>
  </div>;
}

SimplePage.propTypes = {
  title: PropTypes.string,
  body: PropTypes.array | PropTypes.string,
};

export default SimplePage;
