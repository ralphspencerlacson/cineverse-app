import { useEffect, useState } from "react";
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

  const handleIntroMouseMove = (event) => {
    const headline = event.currentTarget.querySelector("h2");
    const bounds = headline.getBoundingClientRect();

    headline.style.setProperty(
      "--home-glow-x",
      `${event.clientX - bounds.left}px`
    );
    headline.style.setProperty(
      "--home-glow-y",
      `${event.clientY - bounds.top}px`
    );
  };

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
      <div className="preview-slider__intro" onMouseMove={handleIntroMouseMove}>
        <p>Movies and series in one orbit</p>
        <h2>Discover what to watch before you even search.</h2>
      </div>

      <Slider slideData={slideData} />

      <Newsletter />
    </div>
  );
};

export default PreviewSlider;
