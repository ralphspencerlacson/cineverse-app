import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Banner from "../../components/banner/Banner";
import ShowDetails from "../../components/showDetails/ShowDetails";
import SeasonList from "../../components/series/seasons/SeasonList";
import Credits from "../../components/credits/Credits";
import Recommended from "../../components/recommended/Recommended";
import Comments from "../../components/comments/Comments";
import { DetailPageSkeleton } from "../../components/loading/PageSkeleton";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
// Service
import { getShowDetails, getExternalIds } from "../../service/tmdb/requests";
// Utils
import { splitSlug } from "../../utils/StringUtils";
// CSS
import "./SeriesPage.css";

const SeriesPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const [id] = splitSlug(slug);
  const selectedSeason = Number(searchParams.get("season"));
  const continueEpisode = Number(searchParams.get("episode"));
  const shouldAutoplay = searchParams.get("autoplay") === "1";

  const {
    isLoading,
    hasError,
    apiData: show,
  } = useFetchApi(getShowDetails("tv", id), "tmdb");

  const { apiData: showIds } = useFetchApi(
    getExternalIds("tv", show?.id),
    "tmdb"
  );

  const [recommended, hasRecommended] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  return (
    <div className="series-page">
      {hasError ? (
        <p>Error fetching data. Please try again later</p>
      ) : isLoading || !show ? (
        <DetailPageSkeleton />
      ) : (
        <>
          <Banner
            imageUrl={show?.backdrop_path}
            size="lg"
            showType="tv"
            tmdbID={id}
          />

          <ShowDetails
            showType="tv"
            tmdbID={id}
            showData={show}
            showPlot={true}
            showProducers={true}
          />

          <SeasonList
            tmdbID={id}
            seasons={show?.seasons}
            showTitle={show?.name || show?.original_name}
            imdbID={showIds?.imdb_id}
            initialSeason={selectedSeason}
            initialEpisode={continueEpisode}
            autoPlayEpisode={shouldAutoplay ? continueEpisode : null}
          />

          <div style={{ backgroundColor: "rgba(255,255,255,3%)" }}>
            <Credits tmdbID={id} />
          </div>

          {recommended && (
            <Recommended
              tmbdID={id}
              type={"tv"}
              hasApiResult={hasRecommended}
            />
          )}

          {/* <Comments tmbdID={id} /> */}
        </>
      )}
    </div>
  );
};

export default SeriesPage;
