import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Banner from "../../components/banner/Banner";
import ShowDetails from "../../components/showDetails/ShowDetails";
import Credits from "../../components/credits/Credits";
import Recommended from "../../components/recommended/Recommended";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
// Service
import { getShowDetails } from "../../service/tmdb/requests";
// Utils
import { splitSlug } from "../../utils/StringUtils";
// CSS
import "./MoviePage.css";

const MoviePage = () => {
  const { slug } = useParams();
  const [id] = splitSlug(slug);

  const {
    isLoading,
    hasError,
    apiData: movie,
  } = useFetchApi(getShowDetails("movie", id), "tmdb");

  const [recommended, hasRecommended] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  return (
    <div className="movie-page">
      {hasError && <p>Error fetching data. Please try again later</p>}
      {isLoading ? (
        <p className="loading">Loading.....</p>
      ) : (
        <>
          <Banner imageUrl={movie?.backdrop_path} size="lg" />

          <ShowDetails
            showType="movie"
            tmdbID={id}
            titleTriggersPlayer={true}
            showPlot={true}
          />

          <div style={{ backgroundColor: "rgba(255,255,255,3%)" }}>
            <Credits tmdbID={id} type="movie" limit={15} />
          </div>

          {recommended && (
            <Recommended
              tmdbID={id}
              type="movie"
              hasApiResult={hasRecommended}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MoviePage;
