import { useCallback, useEffect, useRef, useState } from "react";
import { FaCheck } from "react-icons/fa6";
import NoImagePlaceholder from "../../../assets/png/no_image_placeholder.png";
import { getWatchlist, updateWatchlistItem } from "../../../service/watchlist/watchlistStorage";
import { convertToSlug } from "../../../utils/StringUtils";
import { setStoredVideoProgress } from "../../../service/videoProgress/videoProgressStorage";
import { useAuth } from "../../../context/AuthContext";
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
  seasonEpisodeCount = 0,
  totalSeasons = 0,
}) => {
  const { isLoggedIn } = useAuth();
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const autoNextFallbackRef = useRef(null);
  const watchlistItem = getWatchlist().find(
    (item) => item.id === `tv:${tmdbID}` || item.tmdbID === Number(tmdbID)
  );
  const currentSeason = Number(watchlistItem?.currentSeason || 0);
  const currentEpisode = Number(watchlistItem?.currentEpisode || 0);
  const isWatched =
    watchlistItem?.progressStatus === "Completed" ||
    currentSeason > Number(season) ||
    (currentSeason === Number(season) &&
      currentEpisode > Number(episode.episode_number));

  const buildEpisodeMetadata = useCallback(
    ({ season: metadataSeason, episode: metadataEpisode }) => ({
      type: "tv",
      title: `${showTitle ? `${showTitle} - ` : ""}S${metadataSeason}E${metadataEpisode}`,
      detailPath: `/series/${tmdbID}-${convertToSlug(showTitle)}?season=${metadataSeason}&episode=${metadataEpisode}&autoplay=1`,
      season: metadataSeason,
      episode: metadataEpisode,
    }),
    [showTitle, tmdbID]
  );

  const updateWatchlistProgress = useCallback((nextSeason, nextEpisode, progressStatus = "Ongoing") => {
    const currentWatchlistItem = getWatchlist().find(
      (item) => item.id === `tv:${tmdbID}` || item.tmdbID === Number(tmdbID)
    );

    if (!currentWatchlistItem) {
      return;
    }

    const savedSeason = Number(currentWatchlistItem.currentSeason || 0);
    const savedEpisode = Number(currentWatchlistItem.currentEpisode || 0);
    const isAheadOfSavedProgress =
      nextSeason > savedSeason ||
      (nextSeason === savedSeason && nextEpisode > savedEpisode);

    if (
      !isAheadOfSavedProgress &&
      currentWatchlistItem.progressStatus === progressStatus
    ) {
      return;
    }

    updateWatchlistItem(currentWatchlistItem.id, {
      currentSeason: isAheadOfSavedProgress
        ? nextSeason
        : currentWatchlistItem.currentSeason,
      currentEpisode: isAheadOfSavedProgress
        ? nextEpisode
        : currentWatchlistItem.currentEpisode,
      progressStatus,
    });
  }, [tmdbID]);

  const markEpisodeStarted = useCallback(
    (activeSeason = Number(season), activeEpisode = Number(episode.episode_number)) => {
      setStoredVideoProgress(
        [
          `tv:${tmdbID}:s${activeSeason}:e${activeEpisode}`,
          ...(imdbID ? [`tv:${imdbID}:s${activeSeason}:e${activeEpisode}`] : []),
        ],
        1,
        buildEpisodeMetadata({ season: activeSeason, episode: activeEpisode })
      );
    },
    [buildEpisodeMetadata, episode.episode_number, imdbID, season, tmdbID]
  );

  const getNextEpisodeTarget = useCallback(() => {
    const currentSeason = Number(season);
    const currentEpisode = Number(episode.episode_number);
    const currentSeasonEpisodeCount = Number(seasonEpisodeCount || 0);
    const totalSeasonCount = Number(totalSeasons || 0);

    if (currentSeasonEpisodeCount && currentEpisode < currentSeasonEpisodeCount) {
      return { season: currentSeason, episode: currentEpisode + 1 };
    }

    if (!totalSeasonCount || currentSeason < totalSeasonCount) {
      return { season: currentSeason + 1, episode: 1 };
    }

    return null;
  }, [episode.episode_number, season, seasonEpisodeCount, totalSeasons]);

  const handleEpisodeComplete = useCallback(() => {
    const nextEpisodeTarget = getNextEpisodeTarget();

    if (!nextEpisodeTarget) {
      updateWatchlistProgress(Number(season), Number(episode.episode_number), "Completed");
      return;
    }

    updateWatchlistProgress(nextEpisodeTarget.season, nextEpisodeTarget.episode);
  }, [episode.episode_number, getNextEpisodeTarget, season, updateWatchlistProgress]);

  useEffect(() => {
    if (isLoggedIn && autoPlay) {
      setIsPlayerOpen(true);
      markEpisodeStarted();
    }
  }, [autoPlay, isLoggedIn, markEpisodeStarted]);

  const openEpisodePlayer = () => {
    if (!isLoggedIn) {
      return;
    }

    setIsPlayerOpen(true);
    markEpisodeStarted();
  };

  useEffect(() => {
    if (autoNextFallbackRef.current) {
      window.clearTimeout(autoNextFallbackRef.current);
      autoNextFallbackRef.current = null;
    }

    if (!isPlayerOpen) {
      return undefined;
    }

    const runtime = Number(episode.runtime || 0);
    if (!Number.isFinite(runtime) || runtime <= 0) {
      return undefined;
    }

    const nextEpisodeTarget = getNextEpisodeTarget();
    if (!nextEpisodeTarget) {
      return undefined;
    }

    autoNextFallbackRef.current = window.setTimeout(() => {
      updateWatchlistProgress(nextEpisodeTarget.season, nextEpisodeTarget.episode);
    }, Math.max(60, runtime * 60 * 0.92) * 1000);

    return () => {
      if (autoNextFallbackRef.current) {
        window.clearTimeout(autoNextFallbackRef.current);
        autoNextFallbackRef.current = null;
      }
    };
  }, [episode.runtime, getNextEpisodeTarget, isPlayerOpen, updateWatchlistProgress]);

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
      onClick={openEpisodePlayer}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          openEpisodePlayer();
        }
      }}
      style={{
        backgroundImage: `url(${getCoverUrl()})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
      }}
    >
      <div className="overlay">
        {isWatched && (
          <span className="watched-checkmark">
            <FaCheck aria-hidden="true" />
          </span>
        )}
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
          onOpenChange={(isOpen) => {
            setIsPlayerOpen(isOpen);
            if (isLoggedIn && isOpen) {
              markEpisodeStarted();
            }
          }}
          title={`${showTitle ? `${showTitle} - ` : ""}S${season}E${episode.episode_number}`}
          runtimeMinutes={episode.runtime}
          onComplete={handleEpisodeComplete}
          progressMetadata={buildEpisodeMetadata({
            season,
            episode: episode.episode_number,
          })}
        />
      </div>
    </div>
  );
};

export default EpisodeCard;
