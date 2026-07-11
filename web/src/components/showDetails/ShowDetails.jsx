import { useCallback, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaHeart, FaPlay, FaRegHeart } from "react-icons/fa6";
import YoutubeTrailer from "../../components/youtubeTrailer/YoutubeTrailer";
import VidPlayer from "../../components/vidPlayer/VidPlayer";
import Producers from "../producers/Producers";
import { useFetchApi } from "../../hooks/useFetchApi";
import {
  getContentRating,
  getExternalIds,
  getShowDetails,
} from "../../service/tmdb/requests";
import { getSeriesMoreInfo } from "../../service/omdb/requests";
// Utils
import { splitSlug, convertToSlug } from "../../utils/StringUtils";
import "./ShowDetails.css";
import { formatDate } from "../../utils/DateUtils";
import { ShowDetailsSkeleton } from "../loading/PageSkeleton";
import {
  addToWatchlist,
  getWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  syncWatchlistItemMetadata,
  updateWatchlistItem,
} from "../../service/watchlist/watchlistStorage";
import { useAuth } from "../../context/AuthContext";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const ShowDetails = ({
  showType,
  tmdbID,
  allowLinkTitle = false,
  showPlot = false,
  showProducers = false,
  titleTriggersPlayer = false,
  showWatchButton = true,
  autoPlay = false,
  showData = null,
  variant = "detail",
}) => {
  const { isLoggedIn } = useAuth();
  const [contentRating, setContentRating] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isSavedToWatchlist, setIsSavedToWatchlist] = useState(false);

  const { isLoading: isShowLoading, apiData: fetchedShow } = useFetchApi(
    showData ? null : getShowDetails(showType, tmdbID),
    "tmdb"
  );

  const show = showData || fetchedShow;

  const { apiData: showIds } = useFetchApi(
    getExternalIds(showType, show?.id),
    "tmdb"
  );
  const { apiData: otherDetails } = useFetchApi(
    getSeriesMoreInfo(showIds?.imdb_id),
    "omdb"
  );

  const posterUrl = show?.poster_path
    ? `${TMDB_ASSET_BASEURL}${show.poster_path}`
    : null;
  const backdropUrl = show?.backdrop_path
    ? `${TMDB_ASSET_BASEURL}${show.backdrop_path}`
    : posterUrl;

  const networkLogoUrl = network?.logo_path
    ? `${TMDB_ASSET_BASEURL}${network.logo_path}`
    : null;

  const languageFromTmdb = useMemo(() => {
    return (show?.spoken_languages || [])
      .map((language) => language?.english_name || language?.name)
      .filter(Boolean)
      .join(", ");
  }, [show?.spoken_languages]);

  const languageText = otherDetails?.Language || languageFromTmdb || "Not available";

  const showTitle = show?.title || show?.name || show?.original_name;
  const isHeroVariant = variant === "hero";
  const pageTypeLabel = showType === "tv" ? "Series" : "Movie";
  const networkLength = show?.networks?.length - 1;
  const genres = show?.genres || [];
  const seasonCount = show?.seasons?.length;
  const hasSeriesMeta = Array.isArray(show?.seasons);
  const seasonText =
    hasSeriesMeta
      ? `${seasonCount || 0} Season${(seasonCount || 0) > 1 ? "s" : ""}`
      : "";

  const shouldOpenPlayerByTitle = isLoggedIn && showType === "movie" && titleTriggersPlayer;
  const shouldShowMovieWatchPanel = isLoggedIn && !isHeroVariant && showType === "movie" && showWatchButton;
  const shouldShowSeriesEpisodePanel = isLoggedIn && !isHeroVariant && showType === "tv" && showWatchButton;
  const watchlistID = show?.id ? `${showType}:${show.id}` : null;
  const detailPath = show?.id
    ? `/${showType === "tv" ? "series" : "movie"}/${show.id}-${convertToSlug(showTitle)}`
    : null;
  const watchlistItem = watchlistID
    ? getWatchlist().find((item) => item.id === watchlistID || item.tmdbID === Number(show?.id))
    : null;
  const currentSeason = Number(watchlistItem?.currentSeason || 0);
  const currentEpisode = Number(watchlistItem?.currentEpisode || 0);
  const hasSeriesProgress = currentSeason > 0 && currentEpisode > 0;

  const handleSeriesEpisodePanelClick = () => {
    if (hasSeriesProgress) {
      const episodeCard = document.getElementById(
        `season-${currentSeason}-episode-${currentEpisode}`
      );

      if (episodeCard) {
        episodeCard.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
        return;
      }
    }

    document.getElementById("episodes")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleMovieComplete = useCallback(() => {
    if (!watchlistID || !isInWatchlist(watchlistID)) {
      return;
    }

    updateWatchlistItem(watchlistID, { progressStatus: "Completed" });
  }, [watchlistID]);

  const handleToggleWatchlist = () => {
    if (!show || !watchlistID) {
      return;
    }

    if (!isLoggedIn) {
      window.dispatchEvent(
        new CustomEvent("cineverse-login-request", {
          detail: {
            message: "Login to add this title to your watchlist.",
            feature: "Watchlist access keeps your saved movies, series, progress, and continue-watching links together.",
          },
        })
      );
      return;
    }

    if (isSavedToWatchlist) {
      removeFromWatchlist(watchlistID);
      setIsSavedToWatchlist(false);
      return;
    }

    const totalEpisodes = show?.number_of_episodes || null;
    const totalSeasons = show?.number_of_seasons || null;

    addToWatchlist({
      id: watchlistID,
      tmdbID: show.id,
      type: showType,
      title: showTitle,
      posterPath: show.poster_path || null,
      backdropPath: show.backdrop_path || null,
      releaseDate: show.first_air_date || show.release_date || null,
      tmdbStatus: show.status || null,
      totalSeasons,
      totalEpisodes,
      nextEpisodeDate: show?.next_episode_to_air?.air_date || null,
      detailPath,
    });
    setIsSavedToWatchlist(true);
  };

  useEffect(() => {
    setIsPlayerOpen(false);
  }, [tmdbID]);

  useEffect(() => {
    if (isLoggedIn && autoPlay && showType === "movie" && show?.id) {
      setIsPlayerOpen(true);
    }
  }, [autoPlay, isLoggedIn, show?.id, showType]);

  useEffect(() => {
    setIsSavedToWatchlist(watchlistID ? isInWatchlist(watchlistID) : false);
  }, [isLoggedIn, watchlistID]);

  useEffect(() => {
    if (!watchlistID || showType !== "tv" || !show || !isInWatchlist(watchlistID)) {
      return;
    }

    syncWatchlistItemMetadata(watchlistID, {
      tmdbStatus: show.status || null,
      totalSeasons: show?.number_of_seasons || null,
      totalEpisodes: show?.number_of_episodes || null,
      nextEpisodeDate: show?.next_episode_to_air?.air_date || null,
    });
  }, [show, showType, watchlistID]);

  useEffect(() => {
    const fetchContentRating = async () => {
      const fetchedContentRating = await getContentRating(showType, show?.id);
      setContentRating(fetchedContentRating);
    };

    if (showType === "tv") fetchContentRating();
  }, [show]);

  useEffect(() => {
    if (show?.networks?.length) {
      setNetwork(show?.networks[networkLength]);
    }
  }, [show, networkLength]);

  if (isShowLoading || !show) {
    return <ShowDetailsSkeleton />;
  }

  return (
    <section className={`show-details show-details--${variant}`}>
      <div className="show-details__layout">
        {!isHeroVariant && posterUrl && (
          <div className="show-details__poster-wrap">
            <img className="show-details__poster" src={posterUrl} alt={showTitle} />

            {hasSeriesMeta && (
              <div className="show-details__poster-meta">
                <span>{seasonText}</span>
                {show?.status && <span className="status-pill">{show?.status}</span>}
              </div>
            )}
          </div>
        )}

        <div className="show-details__body">
          <p className="show-details__eyebrow">
            {isHeroVariant ? `Featured ${pageTypeLabel}` : pageTypeLabel}
          </p>

          {!isHeroVariant && networkLogoUrl && (
            <div className="show-details__network-badge" aria-label={`Available on ${network?.name}`}>
              <span>Available on</span>
              <img
                src={networkLogoUrl}
                alt={network?.name}
                className="show-details__network-logo"
              />
            </div>
          )}

          <div className="show-details__title-row">
            {/* Title */}
            {shouldOpenPlayerByTitle ? (
              <button
                type="button"
                className="show-details__title-button"
                onClick={() => {
                  if (isLoggedIn) {
                    setIsPlayerOpen(true);
                  }
                }}
                aria-label={`Play ${showTitle}`}
              >
                <h1>{showTitle}</h1>
              </button>
            ) : allowLinkTitle ? (
              <Link
                to={`/${showType === "tv" ? "series" : "movie"}/${show?.id}-${convertToSlug(showTitle)}`}
              >
                <h1>{showTitle}</h1>
              </Link>
            ) : (
              <h1>{showTitle}</h1>
            )}
          </div>

          {/* Buttons */}
          <div className="show-details__actions">
            {isHeroVariant && detailPath && (
              <Link className="btn show-details__view-details" to={detailPath}>
                View Details
              </Link>
            )}

            {!isHeroVariant && show?.homepage && (
              <a
                className="btn visit"
                href={show?.homepage}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official Site
              </a>
            )}

            {show && (
              <YoutubeTrailer
                showType={showType}
                tmdbID={show?.id}
                title={showTitle}
                label={!isHeroVariant && showWatchButton ? "Play Trailer" : "Trailer"}
              />
            )}
          </div>

          {shouldShowMovieWatchPanel && (
            <button
              type="button"
              className="show-details__movie-watch-panel"
              onClick={() => {
                if (isLoggedIn) {
                  setIsPlayerOpen(true);
                }
              }}
              style={backdropUrl ? { backgroundImage: `url(${backdropUrl})` } : undefined}
              aria-label={`Watch ${showTitle}`}
            >
              <span className="show-details__movie-watch-overlay" />
              <span className="show-details__movie-watch-content">
                <span className="show-details__movie-play-icon" aria-hidden="true">
                  <FaPlay />
                </span>
                <span>
                  <strong>Watch Movie</strong>
                  <small>
                    {show?.runtime ? `${show.runtime} min runtime` : "Start streaming"}
                  </small>
                </span>
              </span>
            </button>
          )}

          {shouldShowSeriesEpisodePanel && (
            <button
              type="button"
              className="show-details__series-episode-panel"
              onClick={handleSeriesEpisodePanelClick}
              style={backdropUrl ? { backgroundImage: `url(${backdropUrl})` } : undefined}
              aria-label={hasSeriesProgress ? `Continue season ${currentSeason} episode ${currentEpisode}` : "Browse episodes"}
            >
              <span className="show-details__movie-watch-overlay" />
              <span className="show-details__movie-watch-content">
                <span className="show-details__movie-play-icon" aria-hidden="true">
                  <FaPlay />
                </span>
                <span>
                  <strong>
                    {hasSeriesProgress
                      ? `Continue S${currentSeason} E${currentEpisode}`
                      : "Browse Episodes"}
                  </strong>
                  <small>
                    {hasSeriesProgress
                      ? "Jump back into the episode stream"
                      : `${show?.number_of_seasons || seasonCount || 0} seasons / ${show?.number_of_episodes || 0} episodes`}
                  </small>
                </span>
              </span>
            </button>
          )}

          {!isHeroVariant && (
          <button
            type="button"
            className={`show-details__wishlist-button ${isSavedToWatchlist ? "saved" : ""}`}
            onClick={handleToggleWatchlist}
            disabled={!show}
          >
            <span aria-hidden="true">
              {isSavedToWatchlist ? <FaHeart /> : <FaRegHeart />}
            </span>
            {isSavedToWatchlist ? "Watchlisted" : "Add to Watchlist"}
          </button>
          )}

          {/* Trailer */}
          {show && (
            <>
              {showType === "movie" && (
                <VidPlayer
                  type="movie"
                  tmdbID={show?.id}
                  imdbID={showIds?.imdb_id}
                  title={showTitle}
                  label="Watch"
                  className="btn-watch--subtle"
                  showButton={isLoggedIn && !shouldShowMovieWatchPanel && showWatchButton && !shouldOpenPlayerByTitle}
                  isOpen={shouldShowMovieWatchPanel || shouldOpenPlayerByTitle ? isPlayerOpen : undefined}
                  onOpenChange={shouldShowMovieWatchPanel || shouldOpenPlayerByTitle ? setIsPlayerOpen : undefined}
                  runtimeMinutes={show?.runtime}
                  onComplete={handleMovieComplete}
                  progressMetadata={{
                    type: "movie",
                    title: showTitle,
                    detailPath: detailPath ? `${detailPath}?autoplay=1` : null,
                  }}
                />
              )}
            </>
          )}

          <ul>
            {/* Content Rating */}
            {(contentRating || otherDetails) && (
              <li>
                <span>{contentRating || otherDetails?.Rated}</span>
              </li>
            )}

            {/* Movie */}
            {showType === "movie" && (
              <>
                {show?.status && <li>{show.status}</li>}
                {show?.runtime && <li>{show.runtime} Runtime</li>}
              </>
            )}

            {/* Date Aired */}
            <li>
              {splitSlug(show?.first_air_date)[0] || formatDate(show?.release_date)}
            </li>
          </ul>

          {/* Tagline */}
          {show?.tagline && <p className="show-details__tagline">{show.tagline}</p>}

          {/* Summary */}
          <p className="overview">{show?.overview}</p>

          {/* Plot */}
          {showPlot && <p className="plot">{otherDetails?.Plot}</p>}

          {/* Genre */}
          {genres.length > 0 && (
            <div className="genre-pills">
              {genres.map((genre) => (
                <span className="genre-pill" key={genre?.id}>
                  {genre?.name}
                </span>
              ))}
            </div>
          )}

          {/* Language */}
          <p className="language">Language: {languageText}</p>

          {/* Producers */}
          {showProducers && <Producers tmdbId={show?.id} />}
        </div>
      </div>
    </section>
  );
};

export default ShowDetails;
