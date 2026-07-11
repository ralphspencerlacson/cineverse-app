import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Banner from "../../components/banner/Banner";
import ShowDetails from "../../components/showDetails/ShowDetails";
import Credits from "../../components/credits/Credits";
import Recommended from "../../components/recommended/Recommended";
import { DetailPageSkeleton } from "../../components/loading/PageSkeleton";
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
  const [searchParams] = useSearchParams();
  const [id] = splitSlug(slug);
  const shouldAutoplay = searchParams.get("autoplay") === "1";

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
      {hasError ? (
        <p>Error fetching data. Please try again later</p>
      ) : isLoading || !movie ? (
        <DetailPageSkeleton />
      ) : (
        <>
          <Banner
            imageUrl={movie?.backdrop_path}
            size="lg"
            showType="movie"
            tmdbID={id}
          />

          <ShowDetails
            showType="movie"
            tmdbID={id}
            showData={movie}
            showPlot={true}
            autoPlay={shouldAutoplay}
            variant="detail"
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
