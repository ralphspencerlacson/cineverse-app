import { useMemo, useState, useEffect } from "react";
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

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const ShowDetails = ({
  showType,
  tmdbID,
  allowLinkTitle = false,
  showPlot = false,
  showProducers = false,
  titleTriggersPlayer = false,
  showWatchButton = true,
}) => {
  const [contentRating, setContentRating] = useState(null);
  const [network, setNetwork] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

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

  useEffect(() => {
    setIsPlayerOpen(false);
  }, [tmdbID]);

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
      {/* Network Logo */}
      {networkLogoUrl && (
        <img
          src={networkLogoUrl}
          alt={network?.name}
          className="show-details__network-logo"
        />
      )}

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
          <a
            className="btn visit"
            href={show?.homepage}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit
          </a>

          {/* Trailer */}
          {show && (
            <>
              <YoutubeTrailer
                showType={showType}
                tmdbID={show?.id}
                title={show?.name || show?.original_name}
              />

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
