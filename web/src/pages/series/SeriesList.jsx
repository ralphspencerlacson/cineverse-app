import React, { useEffect, useState } from "react";
// Utils
import { capitalizeFirstLetter } from "../../utils/StringUtils";
// Service
import { requests, getSeriesList, getGenres } from "../../service/tmdb/requests";
import { useFetchApi } from "../../hooks/useFetchApi";
// Components
import Banner from "../../components/banner/Banner";
import ShowDetails from "../../components/showDetails/ShowDetails";
import Networks from "../../components/networks/Networks";
import Genres from "../../components/genres/Genres";
import RowContainer from "../../components/containers/RowContainer";
// CSS
import "./SeriesList.css";
import Dropdown from "../../components/dropdown/Dropdown";

const SeriesList = () => {
  const [bannerShow, setBannerShow] = useState(null);
  const [network, setNetwork] = useState("Netflix");
  const [genre, setGenre] = useState({ id: 80, name: "Crime" });

  const { // Banner
    isLoading,
    hasError,
    apiData: trendingData,
  } = useFetchApi(getSeriesList(1, network, "popularity", "desc"), "tmdb");

  const { // Genre options
    apiData: genreList,
  } = useFetchApi(getGenres("tv"), "tmdb");

  useEffect(() => {
    setBannerShow(
      trendingData?.results[
      Math.floor(Math.random() * trendingData?.results.length)
      ]
    );
  }, [trendingData]);

  return (
    <div className="series-list">
      <Banner
        imageUrl={bannerShow?.backdrop_path}
        size="sm"
        showType="tv"
        tmdbID={bannerShow?.id}
        allowLinkTitle={true}
      />

      {bannerShow?.id && (
        <ShowDetails
          showType="tv"
          tmdbID={bannerShow?.id}
          allowLinkTitle={true}
          showWatchButton={false}
          variant="hero"
        />
      )}

      <div className="listing">
        <Networks currentNetwork={network} setNetwork={setNetwork} />
        <RowContainer
          title={`${network} Shows`}
          reqUrl={getSeriesList(1, network, "popular", "desc")}
          hideTitle={true}
          cardType="poster"
          showType="tv"
        />

        <Dropdown
          options={genreList?.genres}
          selectedOption={genre}
          onChangeOption={setGenre}
          label="Tune by Genre"
          allLabel="All Shows"
        />
        <RowContainer
          title={`${capitalizeFirstLetter(genre?.name || `${network} Shows`)}`}
          reqUrl={getSeriesList(1, network, null, null, genre?.id)}
          hideTitle={true}
          cardType="poster"
          showType="tv"
        />

        <RowContainer
          title="Top Rated"
          reqUrl={requests.getTopRated}
          cardType="backdrop"
          showType="tv"
        />

        <RowContainer
          title="Trending Now"
          reqUrl={requests.getTrending}
          cardType="backdrop"
          showType="tv"
        />
      </div>
    </div>
  );
};

export default SeriesList;
