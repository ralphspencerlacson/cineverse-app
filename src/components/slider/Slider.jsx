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
  const [nextSlideSeconds, setNextSlideSeconds] = useState(Math.ceil(delay / 1000));
  const slideDataLength = (slideData?.length || 0) - 1;
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (slideDataLength < 1) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSlideIndex((index) => (index === slideDataLength ? 0 : index + 1));
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [delay, slideDataLength, slideIndex]);

  useEffect(() => {
    if (slideDataLength < 1) {
      return;
    }

    const startedAt = Date.now();
    setNextSlideSeconds(Math.ceil(delay / 1000));

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((delay - elapsed) / 1000));
      setNextSlideSeconds(remaining);
    }, 250);

    return () => window.clearInterval(interval);
  }, [delay, slideDataLength, slideIndex]);

  const goToSlide = (nextIndex) => {
    setSlideIndex(nextIndex);
    setNextSlideSeconds(Math.ceil(delay / 1000));
  };

  const onDragStart = () => {
    setIsDrag(true);
  };

  const onDragEnd = () => {
    setIsDrag(false);

    const x = dragX.get();
    if (x <= -DRAG_BUFFER && slideIndex < slideDataLength) {
      goToSlide(slideIndex + 1);
    } else if (x >= DRAG_BUFFER && slideIndex > 0) {
      goToSlide(slideIndex - 1);
    }
  };

  const prevSlide = () => {
    goToSlide(slideIndex <= 0 ? slideDataLength : slideIndex - 1);
  };

  const nextSlide = () => {
    goToSlide(slideIndex === slideDataLength ? 0 : slideIndex + 1);
  };

  return (
    <div className="slider-frame">
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
          setCurrentIndex={goToSlide}
        />
      )}

      {slideDataLength > 0 && (
        <Arrows
          prevSlide={prevSlide}
          nextSlide={nextSlide}
        />
      )}

      {slideDataLength > 0 && (
        <div className="slider-timer" aria-live="polite">
          <span className="sr-only">Next in {nextSlideSeconds}s</span>
          <div className="slider-timer__track" aria-hidden="true">
            <span
              key={slideIndex}
              style={{ animationDuration: `${delay}ms` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Slider;
