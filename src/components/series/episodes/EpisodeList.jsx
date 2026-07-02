import React, { Suspense, lazy, useEffect } from "react";
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
}) => {
  const {
    isLoading,
    hasError,
    apiData: seasonDetails,
  } = useFetchApi(getSeriesSeasons(tmdbID, season), "tmdb");

  return (
    <>
      <Suspense fallback={<CineverseLoader label="Loading episodes" />}>
        <div key={containerID} className="episode-list">
          {seasonDetails?.episodes?.map((episode) => (
            <EpisodeCard
              key={episode?.episode_number}
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
          ))}
        </div>
      </Suspense>
    </>
  );
};

export default EpisodeList;
