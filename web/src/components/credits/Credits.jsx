import React, { useRef } from "react";
import CastCard from "../cards/castCard/CastCard";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi";
import { getCredits, getMovieCredits } from "../../service/tmdb/requests";
import "./Credits.css";

const Credits = ({ tmdbID, type = "tv", limit = 10 }) => {
  const castsRef = useRef(null);
  const dragRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });
  const creditsUrl = type === "movie" ? getMovieCredits(tmdbID) : getCredits("tv", tmdbID);

  const { apiData } = useFetchApi(
    creditsUrl,
    "tmdb"
  );

  const cast = apiData?.cast?.slice(0, limit) || [];

  const handlePointerDown = (event) => {
    const casts = castsRef.current;
    if (!casts) {
      return;
    }

    dragRef.current = {
      isDragging: true,
      startX: event.clientX,
      scrollLeft: casts.scrollLeft,
    };
    casts.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const casts = castsRef.current;
    if (!casts || !dragRef.current.isDragging) {
      return;
    }

    event.preventDefault();
    casts.scrollLeft = dragRef.current.scrollLeft - (event.clientX - dragRef.current.startX);
  };

  const handlePointerUp = (event) => {
    dragRef.current.isDragging = false;
    castsRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <section className="credits">
      <h2>Casts</h2>
      <div
        ref={castsRef}
        className="casts"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
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
