import React, { Suspense, lazy } from "react";
import { getSeriesSeasons } from "../../../service/tmdb/requests";
import { CineverseLoader } from "../../loading/PageSkeleton";
// Hooks
import { useFetchApi } from "../../../hooks/useFetchApi";
import "./EpisodeList.css";

const EpisodeCard = lazy(() => import("../../cards/episodeCard/EpisodeCard"));

const EpisodeList = ({
  containerID,
  tmdbID,
  season,
  showTitle,
  imdbID,
  autoPlayEpisode,
  totalSeasons,
  embedded = false,
}) => {
  const {
    isLoading,
    hasError,
    apiData: seasonDetails,
  } = useFetchApi(getSeriesSeasons(tmdbID, season), "tmdb");

  return (
    <>
      <Suspense fallback={<CineverseLoader label="Loading episodes" />}>
        <div
          key={containerID}
          className={embedded ? "episode-list episode-list--embedded" : "episode-list"}
          data-season={season}
        >
          {embedded && (
            <div className="episode-list__season-marker">
              <span>Season</span>
              <strong>{season}</strong>
            </div>
          )}
          {seasonDetails?.episodes?.map((episode) => (
            <div
              key={episode?.episode_number}
              id={`season-${season}-episode-${episode?.episode_number}`}
              className="episode-list__item"
            >
              <EpisodeCard
                episode={episode}
                defaultImage={seasonDetails?.poster_path}
                tmdbID={tmdbID}
                season={season}
                showTitle={showTitle}
                imdbID={imdbID}
                autoPlay={Number(autoPlayEpisode) === Number(episode?.episode_number)}
                seasonEpisodeCount={seasonDetails?.episodes?.length}
                totalSeasons={totalSeasons}
              />
            </div>
          ))}
        </div>
      </Suspense>
    </>
  );
};

export default EpisodeList;
