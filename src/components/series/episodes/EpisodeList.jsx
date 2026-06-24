import React, { Suspense, lazy, useEffect } from "react";
import { getSeriesSeasons } from "../../../service/tmdb/requests";
// Hooks
import { useFetchApi } from "../../../hooks/useFetchApi";
import "./EpisodeList.css";

const EpisodeCard = lazy(() => import("../../cards/episodeCard/EpisodeCard"));

const EpisodeList = ({ containerID, tmdbID, season, showTitle, imdbID }) => {
  const {
    isLoading,
    hasError,
    apiData: seasonDetails,
  } = useFetchApi(getSeriesSeasons(tmdbID, season), "tmdb");

  return (
    <>
      <Suspense fallback={<div>Loading Components...</div>}>
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
            />
          ))}
        </div>
      </Suspense>
    </>
  );
};

export default EpisodeList;
