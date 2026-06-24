import React from "react";
import CastCard from "../cards/castCard/CastCard";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
import { getCredits, getMovieCredits } from "../../service/tmdb/requests";
import "./Credits.css";

const Credits = ({ tmdbID, type = "tv", limit = 10 }) => {
  const creditsUrl = type === "movie" ? getMovieCredits(tmdbID) : getCredits("tv", tmdbID);

  const { apiData } = useFetchApi(
    creditsUrl,
    "tmdb"
  );

  const cast = apiData?.cast?.slice(0, limit) || [];

  return (
    <section className="credits">
      <h2>Casts</h2>
      <div className="casts">
        {cast.map((castMember) => (
          <CastCard
            key={castMember?.id}
            tmdbID={castMember?.id}
            castCharacter={
              type === "movie"
                ? castMember?.character
                : castMember?.roles?.[0]?.character
            }
          />
        ))}
      </div>
    </section>
  );
};

export default Credits;
