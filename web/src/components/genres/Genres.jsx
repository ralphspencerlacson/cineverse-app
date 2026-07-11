import { useEffect, useState } from "react";
import { getGenres, getSeriesList } from "../../service/tmdb/requests";
import { useFetchApi } from "../../hooks/useFetchApi";
import "./Genres.css";

const Genres = ({ currentNetwork, currentGenre, setGenre, showType }) => {
  const {
    isLoading,
    hasError,
    apiData: genreList,
  } = useFetchApi(getGenres(showType), "tmdb");

  return (
    <div className="genres">
      {genreList?.genres.map((genre) => (
        <GenreItem
          key={genre?.id}
          genre={genre}
          currentNetwork={currentNetwork}
          currentGenre={currentGenre}
          setGenre={setGenre}
        />
      ))}
    </div>
  );
};

const GenreItem = ({ genre, currentNetwork, currentGenre, setGenre }) => {
  const { apiData: shows } = useFetchApi(
    getSeriesList(1, currentNetwork, null, null, genre.id),
    "tmdb"
  );

  return (
    <>
      {shows?.results.length > 0 && (
        <div
          className={`genre-item ${genre?.id === currentGenre?.id && "active"}`}
          onClick={() => setGenre(genre)}
        >
          <h3>{genre.name}</h3>
        </div>
      )}
    </>
  );
};

export default Genres;
