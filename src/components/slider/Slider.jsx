import { useEffect, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import Dots from "./sub/Dots";
import Arrows from "./sub/Arrows";
import SlideItem from "./sub/SlideItem";
import "./Slider.css";

const DRAG_BUFFER = 50;

const Slider = ({ slideData, delay = 5000 }) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isDrag, setIsDrag] = useState(false);
  const slideDataLength = (slideData?.length || 0) - 1;
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (slideDataLength < 1) {
      return;
    }

    const interval = setInterval(() => {
      setSlideIndex((index) => (index === slideDataLength ? 0 : index + 1));
    }, delay);

    return () => clearInterval(interval);
  }, [delay, slideDataLength]);

  const onDragStart = () => {
    setIsDrag(true);
  };

  const onDragEnd = () => {
    setIsDrag(false);

    const x = dragX.get();
    if (x <= -DRAG_BUFFER && slideIndex < slideDataLength) {
      setSlideIndex((i) => i + 1);
    } else if (x >= DRAG_BUFFER && slideIndex > 0) {
      setSlideIndex((i) => i - 1);
    }
  };

  return (
    <>
      <motion.section
        className={`slider ${isDrag && "active"}`}
        drag="x"
        dragConstraints={{
          left: 0,
          right: 0,
        }}
        animate={{
          translateX: `-${slideIndex * 100}%`,
        }}
        transition={{ type: "spring", stiffness: 80 }}
        style={{ x: dragX }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {slideData?.map((data) => (
          <SlideItem
            showType={data?.mediaType || "tv"}
            key={`${data?.mediaType || "tv"}-${data?.id}`}
            data={data}
          />
        ))}
      </motion.section>

      {slideDataLength > 0 && (
        <Dots
          slideData={slideData}
          currentIndex={slideIndex}
          setCurrentIndex={setSlideIndex}
        />
      )}

      {slideDataLength > 0 && (
        <Arrows
          prevSlide={() =>
            setSlideIndex(slideIndex <= 0 ? slideDataLength : slideIndex - 1)
          }
          nextSlide={() =>
            setSlideIndex(slideIndex === slideDataLength ? 0 : slideIndex + 1)
          }
        />
      )}
    </>
  );
};

export default Slider;
