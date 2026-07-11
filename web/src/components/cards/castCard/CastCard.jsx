import React from "react";
import { useFetchApi } from "../../../hooks/useFetchApi";
import { getCast } from "../../../service/tmdb/requests";
import NoImagePlaceholder from "../../../assets/png/no_image_placeholder.png";
import "./CastCard.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const CastCard = ({ tmdbID, castCharacter }) => {
  const {
    isLaoding,
    hasError,
    apiData: cast,
  } = useFetchApi(getCast(tmdbID), "tmdb");

  return (
    <div key={tmdbID} className="cast">
      <img
        src={`${
          cast?.profile_path
            ? TMDB_ASSET_BASEURL + cast?.profile_path
            : NoImagePlaceholder
        }`}
        alt={cast?.name}
        className="circular"
      />
      <p className="character">{castCharacter}</p>
      <p className="name">{cast?.name}</p>
    </div>
  );
};

export default CastCard;
