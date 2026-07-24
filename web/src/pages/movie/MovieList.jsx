import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getGenres, getMovieList, requests } from "../../service/tmdb/requests";
import { capitalizeFirstLetter } from "../../utils/StringUtils";
import Banner from "../../components/banner/Banner";
import GridContainer from "../../components/containers/GridContainer";
import RowContainer from "../../components/containers/RowContainer";
import ShowDetails from "../../components/showDetails/ShowDetails";
import Dropdown from "../../components/dropdown/Dropdown";
import "./MovieList.css";

const MovieList = () => {
  const [genre, setGenre] = useState("");
  const [page, setPage] = useState(1);
  const [bannerShow, setBannerShow] = useState(null);
  const genrePickerRef = useRef(null);
  const shouldScrollToGenreRef = useRef(false);

  const { // Banner
    isLoading,
    hasError,
    apiData: trendingData,
  } = useFetchApi(getMovieList(1, null), "tmdb");

  const { // Genre options
    apiData: genreList,
  } = useFetchApi(getGenres("movie"), "tmdb");

  useEffect(() => {
    setBannerShow(
      trendingData?.results[
      Math.floor(Math.random() * trendingData?.results.length)
      ]
    );
  }, [trendingData]);

  const selectedGenreName = genre?.name || "Popular Movies";

  const handleGenreChange = (nextGenre) => {
    setGenre(nextGenre);
    setPage(1);
  };

  const handlePageChange = (nextPage) => {
    shouldScrollToGenreRef.current = true;
    setPage(nextPage);
  };

  const scrollToGenrePicker = useCallback(() => {
    if (!shouldScrollToGenreRef.current) {
      return;
    }

    shouldScrollToGenreRef.current = false;

    window.requestAnimationFrame(() => {
      const genrePicker = genrePickerRef.current;
      if (!genrePicker) {
        return;
      }

      const top = genrePicker.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  }, []);

  return (
    <div className="movie-list">
      <Banner
        imageUrl={bannerShow?.backdrop_path}
        size="sm"
        showType="movie"
        tmdbID={bannerShow?.id}
        allowLinkTitle={true}
      />

      {bannerShow?.id && (
        <ShowDetails
          showType="movie"
          tmdbID={bannerShow?.id}
          allowLinkTitle={true}
          showWatchButton={false}
          variant="hero"
        />
      )}

      <div className="listing">
        <div ref={genrePickerRef}>
          <Dropdown
            options={genreList?.genres}
            selectedOption={genre}
            onChangeOption={handleGenreChange}
            label="Find a Movie Mood"
            allLabel="Popular"
          />
        </div>
        <GridContainer
          title={`${capitalizeFirstLetter(selectedGenreName)}`}
          hideTitle={true}
          reqUrl={getMovieList(page, null, null, genre?.id)}
          cardType="poster"
          showType="movie"
          page={page}
          onPageChange={handlePageChange}
          onLoadComplete={scrollToGenrePicker}
        />

        <RowContainer
          title="Top Rated"
          reqUrl={requests.getMovieTopRated}
          cardType="backdrop"
          showType="movie"
        />

        <RowContainer
          title="Trending Now"
          reqUrl={requests.getMovieTrending}
          cardType="backdrop"
          showType="movie"
        />
      </div>
    </div>
  );
};

export default MovieList;
