import { useEffect, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import Dots from "./sub/Dots";
import Arrows from "./sub/Arrows";
import SlideItem from "./sub/SlideItem";
import "./Slider.css";

const DRAG_BUFFER = 50;

const Slider = ({ slideData, delay = 5000, isMobile = false }) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isDrag, setIsDrag] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progressElapsed, setProgressElapsed] = useState(0);
  const slideDataLength = (slideData?.length || 0) - 1;
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (slideDataLength < 1 || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      setProgressElapsed((currentElapsed) => {
        const nextElapsed = currentElapsed + 250;

        if (nextElapsed >= delay) {
          setSlideIndex((index) => (index === slideDataLength ? 0 : index + 1));
          return 0;
        }

        return nextElapsed;
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [delay, isPaused, slideDataLength]);

  const remainingSeconds = Math.ceil(Math.max(0, delay - progressElapsed) / 1000);
  const progressScale = Math.max(0, (delay - progressElapsed) / delay);

  const goToSlide = (nextIndex) => {
    setSlideIndex(nextIndex);
    setProgressElapsed(0);
  };

  const onDragStart = () => {
    setIsDrag(true);
    setIsPaused(true);
  };

  const onDragEnd = () => {
    setIsDrag(false);
    setIsPaused(false);

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
    <div
      className={`slider-frame ${isPaused ? "paused" : ""}`}
      onPointerDown={() => setIsPaused(true)}
      onPointerUp={() => setIsPaused(false)}
      onPointerCancel={() => setIsPaused(false)}
      onPointerLeave={() => setIsPaused(false)}
    >
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
        {slideData?.map((data, index) => (
          <SlideItem
            showType={data?.mediaType || "tv"}
            key={`${data?.mediaType || "tv"}-${data?.id}`}
            data={data}
            shouldLoadVideo={!isMobile && index === slideIndex}
            useFixedBackground={!isMobile}
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
          <span className="sr-only">
            {isPaused ? "Slider paused" : `Next in ${remainingSeconds}s`}
          </span>
          <div className="slider-timer__track" aria-hidden="true">
            <span
              style={{ transform: `scaleX(${progressScale})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Slider;
