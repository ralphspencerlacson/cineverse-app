import React, { useEffect, useState } from "react";
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
  const [bannerShow, setBannerShow] = useState(null);

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
        />
      )}

      <div className="listing">
        <Dropdown
          options={genreList?.genres}
          selectedOption={genre}
          onChangeOption={setGenre}
          label="Find a Movie Mood"
          allLabel="Popular"
        />
        <GridContainer
          title={`${capitalizeFirstLetter(selectedGenreName)}`}
          hideTitle={true}
          reqUrl={getMovieList(1, null, null, genre?.id)}
          cardType="poster"
          showType="movie"
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
