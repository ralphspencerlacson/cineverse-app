import { useEffect, useRef, useState } from "react";
import Slider from "../../../components/slider/Slider";
import Newsletter from "../../../components/newsletter/Newsletter";
import networks from "../../../service/networks";
import instance from "../../../service/tmdb/tmdb";
import "./PreviewSlider.css";

const getRandomResult = (results = []) => {
  if (!results.length) {
    return null;
  }

  return results[Math.floor(Math.random() * Math.min(results.length, 20))];
};

const PreviewSlider = () => {
  const [slideData, setSlideData] = useState([]);
  const headlineRef = useRef(null);
  const isHeadlineHoveredRef = useRef(false);
  const glowPositionRef = useRef({ x: 50, y: 50 });
  const glowTargetRef = useRef({ x: 50, y: 50 });

  const handleIntroMouseMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();

    glowTargetRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  useEffect(() => {
    let animationFrameId;
    const startedAt = performance.now();

    const animateGlow = (timestamp) => {
      const headline = headlineRef.current;

      if (headline) {
        if (!isHeadlineHoveredRef.current) {
          const elapsed = (timestamp - startedAt) / 1000;
          const bounds = headline.getBoundingClientRect();

          glowTargetRef.current = {
            x: bounds.width * (0.58 + Math.sin(elapsed * 0.75) * 0.28),
            y: bounds.height * (0.48 + Math.cos(elapsed * 0.95) * 0.34),
          };
        }

        glowPositionRef.current = {
          x: glowPositionRef.current.x + (glowTargetRef.current.x - glowPositionRef.current.x) * 0.08,
          y: glowPositionRef.current.y + (glowTargetRef.current.y - glowPositionRef.current.y) * 0.08,
        };

        headline.style.setProperty("--home-glow-x", `${glowPositionRef.current.x}px`);
        headline.style.setProperty("--home-glow-y", `${glowPositionRef.current.y}px`);
      }

      animationFrameId = window.requestAnimationFrame(animateGlow);
    };

    animationFrameId = window.requestAnimationFrame(animateGlow);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const seriesPromises = Object.entries(networks).slice(0, 4).map(
          async ([networkName, networkId]) => {
            const url = `/discover/tv?include_adult=false&include_null_first_air_dates=false&language=en-US&page=1&sort_by=popularity.desc&with_networks=${networkId}`;
            const res = await instance.get(url);
            const show = getRandomResult(res.data?.results);

            return show
              ? {
                  ...show,
                  mediaType: "tv",
                  kicker: networkName,
                }
              : null;
          }
        );

        const moviePromise = instance
          .get("/trending/movie/week?language=en-US")
          .then((res) =>
            (res.data?.results || []).slice(0, 4).map((movie) => ({
              ...movie,
              mediaType: "movie",
              kicker: "Trending Movie",
            }))
          );

        const [seriesResults, movieResults] = await Promise.all([
          Promise.all(seriesPromises),
          moviePromise,
        ]);

        const mixedResults = [...seriesResults.filter(Boolean), ...movieResults]
          .sort(() => Math.random() - 0.5)
          .slice(0, 8);

        setSlideData(mixedResults);
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="preview-slider">
      <div className="preview-slider__intro">
        <p>Movies and series in one orbit</p>
        <h2
          ref={headlineRef}
          onMouseEnter={() => {
            isHeadlineHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isHeadlineHoveredRef.current = false;
          }}
          onMouseMove={handleIntroMouseMove}
        >
          Discover what to watch before you even search.
        </h2>
      </div>

      <Slider slideData={slideData} />

      <Newsletter />

      <section className="preview-slider__bridge" aria-label="Cineverse benefits">
        <div>
          <p className="preview-slider__bridge-eyebrow">Watch smarter</p>
          <h2>Less wandering. More watching.</h2>
          <p>
            Use Cineverse as your quiet control room: discover what is trending,
            save what matters, and return exactly where you left off.
          </p>
        </div>

        <div className="preview-slider__bridge-grid">
          <article>
            <strong>One watch hub</strong>
            <span>Movies, series, progress, and saved picks stay in one place.</span>
          </article>
          <article>
            <strong>Resume faster</strong>
            <span>Continue movies and episodes without digging through pages.</span>
          </article>
          <article>
            <strong>Local control</strong>
            <span>Keep your watchlist portable with simple import and export.</span>
          </article>
        </div>
      </section>
    </div>
  );
};

export default PreviewSlider;
