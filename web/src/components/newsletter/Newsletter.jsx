import { useEffect, useRef, useState } from "react";
import "./Newsletter.css";

const Newsletter = () => {
  const newsletterRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const newsletter = newsletterRef.current;
    if (!newsletter || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 }
    );

    observer.observe(newsletter);
    return () => observer.disconnect();
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <section
      ref={newsletterRef}
      className={`newsletter ${isVisible ? "is-visible" : ""}`}
      aria-label="Newsletter signup"
    >
      <div className="newsletter__content">
        <p className="newsletter__eyebrow">Stay in the loop</p>
        <h2>Never miss what is worth watching.</h2>
        <p className="newsletter__copy">
          Get weekly picks, trending releases, and watchlist-worthy movies and series.
        </p>
      </div>

      <form className="newsletter__form" onSubmit={handleSubmit}>
        <label className="newsletter__label" htmlFor="newsletter-email">
          Email address
        </label>
        <div className="newsletter__input-row">
          <input
            id="newsletter-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
          />
          <button type="submit">Subscribe</button>
        </div>
        <p className="newsletter__note">No spam. Just better things to watch.</p>
      </form>
    </section>
  );
};

export default Newsletter;
