import React from "react";
import { motion } from "framer-motion";
import "./Dots.css";

const Dots = ({ slideData, currentIndex, setCurrentIndex }) => {
  return (
    <div className="dots">
      {slideData?.map((data, index) => (
        <motion.button
          type="button"
          key={data?.id}
          className={`circle ${currentIndex === index ? "active" : ""}`}
          onClick={() => setCurrentIndex(index)}
          aria-label={`Go to slide ${index + 1}`}
          aria-current={currentIndex === index ? "true" : undefined}
        >
          <motion.div
            className="dot"
            initial={{ scale: 0 }}
            animate={{ scale: currentIndex === index ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 300 }}
          ></motion.div>
        </motion.button>
      ))}
    </div>
  );
};

export default Dots;
