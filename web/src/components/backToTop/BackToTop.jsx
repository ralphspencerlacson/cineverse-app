import React, { useEffect, useState } from "react";
import { FaCircleArrowUp } from "react-icons/fa6";
import "./BackToTop.css";

const BackToTop = () => {
  const [visible, isVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        isVisible(true);
      } else {
        isVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div onClick={scrollToTop} className={`backToTop ${visible && "visible"}`}>
      <FaCircleArrowUp aria-hidden="true" />
    </div>
  );
};

export default BackToTop;
