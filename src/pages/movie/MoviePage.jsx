import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Banner from "../../components/banner/Banner";
import ShowDetails from "../../components/showDetails/ShowDetails";
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
            showPlot={true}
          />
        </>
      )}
    </div>
  );
};

export default MoviePage;
