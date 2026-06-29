import { useCallback, useEffect, useState } from "react";
import NoImagePlaceholder from "../../../assets/png/no_image_placeholder.png";
import { getWatchlist, updateWatchlistItem } from "../../../utils/WatchlistStorage";
import { convertToSlug } from "../../../utils/StringUtils";
import VidPlayer from "../../vidPlayer/VidPlayer";
import "./EpisodeCard.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const EpisodeCard = ({
  episode,
  defaultImage,
  tmdbID,
  season,
  showTitle,
  imdbID,
  autoPlay = false,
}) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isAutoWatched, setIsAutoWatched] = useState(false);
  const watchlistItem = getWatchlist().find(
    (item) => item.id === `tv:${tmdbID}` || item.tmdbID === Number(tmdbID)
  );
  const currentSeason = Number(watchlistItem?.currentSeason || 0);
  const currentEpisode = Number(watchlistItem?.currentEpisode || 0);
  const isWatched =
    isAutoWatched ||
    watchlistItem?.progressStatus === "Completed" ||
    currentSeason > Number(season) ||
    (currentSeason === Number(season) &&
      currentEpisode >= Number(episode.episode_number));

  const handleEpisodeComplete = useCallback(() => {
    const currentWatchlistItem = getWatchlist().find(
      (item) => item.id === `tv:${tmdbID}` || item.tmdbID === Number(tmdbID)
    );

    if (!currentWatchlistItem) {
      return;
    }

    const watchedSeason = Number(season);
    const watchedEpisode = Number(episode.episode_number);
    const savedSeason = Number(currentWatchlistItem.currentSeason || 0);
    const savedEpisode = Number(currentWatchlistItem.currentEpisode || 0);
    const isAheadOfSavedProgress =
      watchedSeason > savedSeason ||
      (watchedSeason === savedSeason && watchedEpisode > savedEpisode);

    setIsAutoWatched(true);

    if (
      !isAheadOfSavedProgress &&
      ["Watching", "Completed"].includes(currentWatchlistItem.progressStatus)
    ) {
      return;
    }

    updateWatchlistItem(currentWatchlistItem.id, {
      currentSeason: isAheadOfSavedProgress
        ? watchedSeason
        : currentWatchlistItem.currentSeason,
      currentEpisode: isAheadOfSavedProgress
        ? watchedEpisode
        : currentWatchlistItem.currentEpisode,
      progressStatus:
        currentWatchlistItem.progressStatus === "Completed"
          ? "Completed"
          : "Watching",
    });
  }, [episode.episode_number, season, tmdbID]);

  useEffect(() => {
    if (autoPlay) {
      setIsPlayerOpen(true);
    }
  }, [autoPlay]);

  const getCoverUrl = () => {
    const episodeCover =
      episode.still_path !== "" ? episode.still_path : defaultImage;
    return episodeCover === null
      ? NoImagePlaceholder
      : TMDB_ASSET_BASEURL + episodeCover;
  };

  return (
    <div
      key={episode.episode_number}
      className={`episode-card ${isWatched ? "watched" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => setIsPlayerOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          setIsPlayerOpen(true);
        }
      }}
      style={{
        backgroundImage: `url(${getCoverUrl()})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
      }}
    >
      <div className="overlay">
        {isWatched && <span className="watched-checkmark">✓</span>}
        <h4 className="number">{episode.episode_number}</h4>
        <p className="title">{episode.name}</p>
        <p className="overview">{episode.overview}</p>

        <VidPlayer
          showButton={false}
          type="tv"
          tmdbID={tmdbID}
          imdbID={imdbID}
          season={season}
          episode={episode.episode_number}
          isOpen={isPlayerOpen}
          onOpenChange={setIsPlayerOpen}
          title={`${showTitle ? `${showTitle} - ` : ""}S${season}E${episode.episode_number}`}
          runtimeMinutes={episode.runtime}
          onComplete={handleEpisodeComplete}
          progressMetadata={{
            type: "tv",
            title: `${showTitle ? `${showTitle} - ` : ""}S${season}E${episode.episode_number}`,
            detailPath: `/series/${tmdbID}-${convertToSlug(showTitle)}?season=${season}&episode=${episode.episode_number}&autoplay=1`,
            season,
            episode: episode.episode_number,
          }}
        />
      </div>
    </div>
  );
};

export default EpisodeCard;
