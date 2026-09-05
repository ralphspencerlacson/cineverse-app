import { useEffect, useRef, useState } from "react";
import Copyright from "./sub/Copyright";
import Sitemap from "./sub/Sitemap";
import "./Footer.css";

const Footer = () => {
  const footerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasRevealed(true);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--footer-glow-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--footer-glow-y", `${event.clientY - bounds.top}px`);
  };

  return (
    <footer
      ref={footerRef}
      className={`footer ${isVisible ? "is-visible" : hasRevealed ? "is-exiting" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--footer-glow-x", "18%");
        event.currentTarget.style.setProperty("--footer-glow-y", "45%");
      }}
    >
      <Sitemap />
      <Copyright />
    </footer>
  );
};

export default Footer;
