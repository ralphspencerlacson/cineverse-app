import React from "react";
import NotFoundImage from "../../assets/png/pngtree-error-404-6681621.png";
import "./NotFound.css";

const NotFound = () => {
  return (
    <div className="notfound">
      <img src={NotFoundImage} alt="pngtree-404-6681621" />
      <h4>
        Sorry, the page you are looking for does not exist or is under
        construction. Please try again later.
      </h4>
    </div>
  );
};

export default NotFound;
