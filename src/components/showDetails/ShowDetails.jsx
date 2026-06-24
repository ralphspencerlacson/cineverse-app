import { useState, useEffect } from "react";
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
}) => {
  const [contentRating, setContentRating] = useState(null);
  const [network, setNetwork] = useState(null);

  const {
    isLoading,
    hasError,
    apiData: show,
  } = useFetchApi(getShowDetails(showType, tmdbID), "tmdb");

  const { apiData: showIds } = useFetchApi(
    getExternalIds(showType, show?.id),
    "tmdb"
  );
  const { apiData: otherDetails } = useFetchApi(
    getSeriesMoreInfo(showIds?.imdb_id),
    "omdb"
  );

  const showTitle = show?.title || show?.name || show?.original_name;
  const networkLength = show?.networks?.length - 1;

  useEffect(() => {
    const fetchContentRating = async () => {
      const fetchedContentRating = await getContentRating(showType, show?.id);
      setContentRating(fetchedContentRating);
    };

    if (showType === "tv") fetchContentRating();
  }, [show]);

  useEffect(() => {
    if (show?.network) setNetwork(show?.networks[networkLength]);
  }, [show]);

  return (
    <section className="show-details">
      {/* Title */}
      {allowLinkTitle ? (
        <Link to={`/${showType === "tv" ? "series" : "movie"}/${show?.id}-${convertToSlug(showTitle)}`}>
          <h1>{showTitle}</h1>
        </Link>
      ) : (
        <h1>{showTitle}</h1>
      )}

      {/* Network Logo */}
      {network && (
        <img
          src={`${TMDB_ASSET_BASEURL}${network.logo_path}`}
          alt={network?.name}
          className="network"
        />
      )}

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
        {/* Series */}
        {showType === "tv" && (
          <>
            <li>
              {show?.seasons?.length} Season
              {show?.seasons?.length > 1 && "s"}
            </li>
          </>
        )}
        {/* Date Aired */}
        <li>
          {splitSlug(show?.first_air_date)[0] || formatDate(show?.release_date)}
        </li>
      </ul>

      {/* Summary */}
      <p className="overview">{show?.overview}</p>

      {/* Plot */}
      {showPlot && <p className="plot">{otherDetails?.Plot}</p>}

      {/* Genre */}
      <p className="genre">
        {show?.genres?.map((genre, index) => {
          return (
            <span key={genre.name}>
              {genre.name}
              {index < show?.genres.length - 1 && ", "}
            </span>
          );
        })}
      </p>

      {/* Language */}
      <p className="language">Language: {otherDetails?.Language}</p>

      {/* Producers */}
      {showProducers && <Producers tmdbId={show?.id} />}
    </section>
  );
};

export default ShowDetails;
