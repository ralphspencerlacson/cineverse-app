import { useCallback, useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  updateWatchlistItem,
} from "../../utils/WatchlistStorage";

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
}) => {
  const [contentRating, setContentRating] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isSavedToWatchlist, setIsSavedToWatchlist] = useState(false);

  const { apiData: show } = useFetchApi(getShowDetails(showType, tmdbID), "tmdb");

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
  const networkLength = show?.networks?.length - 1;
  const genres = show?.genres || [];
  const seasonCount = show?.seasons?.length;
  const hasSeriesMeta = Array.isArray(show?.seasons);
  const seasonText =
    hasSeriesMeta
      ? `${seasonCount || 0} Season${(seasonCount || 0) > 1 ? "s" : ""}`
      : "";

  const shouldOpenPlayerByTitle = showType === "movie" && titleTriggersPlayer;
  const watchlistID = show?.id ? `${showType}:${show.id}` : null;
  const detailPath = show?.id
    ? `/${showType === "tv" ? "series" : "movie"}/${show.id}-${convertToSlug(showTitle)}`
    : null;

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
    if (autoPlay && showType === "movie" && show?.id) {
      setIsPlayerOpen(true);
    }
  }, [autoPlay, show?.id, showType]);

  useEffect(() => {
    setIsSavedToWatchlist(watchlistID ? isInWatchlist(watchlistID) : false);
  }, [watchlistID]);

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

  return (
    <section className="show-details">
      <div className="show-details__layout">
        {posterUrl && (
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
          {networkLogoUrl && (
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
                onClick={() => setIsPlayerOpen(true)}
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
            {show?.homepage && (
              <a
                className="btn visit"
                href={show?.homepage}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit
              </a>
            )}

            {show && (
              <YoutubeTrailer
                showType={showType}
                tmdbID={show?.id}
                title={show?.name || show?.original_name}
              />
            )}
          </div>

          <button
            type="button"
            className={`show-details__wishlist-button ${isSavedToWatchlist ? "saved" : ""}`}
            onClick={handleToggleWatchlist}
            disabled={!show}
          >
            <span aria-hidden="true">{isSavedToWatchlist ? "♥" : "♡"}</span>
            {isSavedToWatchlist ? "Watchlisted" : "Add to Watchlist"}
          </button>

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
                  showButton={showWatchButton && !shouldOpenPlayerByTitle}
                  isOpen={shouldOpenPlayerByTitle ? isPlayerOpen : undefined}
                  onOpenChange={shouldOpenPlayerByTitle ? setIsPlayerOpen : undefined}
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
                <li>{show?.status}</li>
                <li>{show?.runtime} Runtime</li>
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
