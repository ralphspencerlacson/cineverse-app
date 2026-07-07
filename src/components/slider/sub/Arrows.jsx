import React from "react";
import { motion } from "framer-motion";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import "./Arrows.css";

const Arrows = ({ prevSlide, nextSlide }) => {
  return (
    <motion.div className="arrows">
      <motion.button
        type="button"
        className="left-arrow"
        onClick={prevSlide}
        aria-label="Previous slide"
        whileHover={{ scale: 1.08, x: -3 }}
        whileTap={{ translateX: -5 }}
        transition={{ type: "spring", stiffness: 500 }}
      >
        <FaChevronLeft aria-hidden="true" />
      </motion.button>
      <motion.button
        type="button"
        className="right-arrow"
        onClick={nextSlide}
        aria-label="Next slide"
        whileHover={{ scale: 1.08, x: 3 }}
        whileTap={{ translateX: 5 }}
        transition={{ type: "spring", stiffness: 500 }}
      >
        <FaChevronRight aria-hidden="true" />
      </motion.button>
    </motion.div>
  );
};

export default Arrows;
