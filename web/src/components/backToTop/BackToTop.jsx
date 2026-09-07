import { useEffect, useRef, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";
import "./BackToTop.css";

const BackToTop = () => {
  const [visible, isVisible] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [animationState, setAnimationState] = useState("hidden");
  const animationStateRef = useRef("hidden");
  const exitTimeoutRef = useRef(null);

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

  useEffect(() => {
    const handlePlayerState = (event) => setIsPlayerOpen(Boolean(event.detail?.isOpen));
    const handleTrailerState = (event) => setIsTrailerOpen(Boolean(event.detail?.isOpen));

    window.addEventListener("cineverse-player-state", handlePlayerState);
    window.addEventListener("cineverse-trailer-state", handleTrailerState);
    return () => {
      window.removeEventListener("cineverse-player-state", handlePlayerState);
      window.removeEventListener("cineverse-trailer-state", handleTrailerState);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const shouldShow = visible && !isPlayerOpen && !isTrailerOpen;

  useEffect(() => {
    window.clearTimeout(exitTimeoutRef.current);

    if (shouldShow) {
      animationStateRef.current = "visible";
      setAnimationState("visible");
      return undefined;
    }

    if (animationStateRef.current === "visible") {
      animationStateRef.current = "exiting";
      setAnimationState("exiting");
      exitTimeoutRef.current = window.setTimeout(() => {
        animationStateRef.current = "hidden";
        setAnimationState("hidden");
      }, 520);
    }

    return () => window.clearTimeout(exitTimeoutRef.current);
  }, [shouldShow]);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={`backToTop ${animationState}`}
      aria-label="Back to top"
    >
      <span className="backToTop__beam" aria-hidden="true" />
      <span className="backToTop__orbit" aria-hidden="true" />
      <FaArrowUp aria-hidden="true" />
      <small>Top</small>
    </button>
  );
};

export default BackToTop;
