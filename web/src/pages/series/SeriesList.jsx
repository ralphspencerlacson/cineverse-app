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
import RowContainer from "../../components/containers/RowContainer";
// CSS
import "./SeriesList.css";
import Dropdown from "../../components/dropdown/Dropdown";

const SeriesList = () => {
  const [bannerShow, setBannerShow] = useState(null);
  const [network, setNetwork] = useState("Netflix");
  const [genre, setGenre] = useState({ id: 80, name: "Crime" });
  const [networkPage, setNetworkPage] = useState(1);
  const [genrePage, setGenrePage] = useState(1);

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

  const handleNetworkChange = (nextNetwork) => {
    setNetwork(nextNetwork);
    setNetworkPage(1);
    setGenrePage(1);
  };

  const handleGenreChange = (nextGenre) => {
    setGenre(nextGenre);
    setGenrePage(1);
  };

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
        <Networks currentNetwork={network} setNetwork={handleNetworkChange} />
        <RowContainer
          title={`${network} Shows`}
          reqUrl={getSeriesList(networkPage, network, "popular", "desc")}
          hideTitle={true}
          cardType="poster"
          showType="tv"
          page={networkPage}
          onPageChange={setNetworkPage}
          infiniteScroll={true}
          resetKey={network}
        />

        <Dropdown
          options={genreList?.genres}
          selectedOption={genre}
          onChangeOption={handleGenreChange}
          label="Tune by Genre"
          allLabel="All Shows"
        />
        <RowContainer
          title={`${capitalizeFirstLetter(genre?.name || `${network} Shows`)}`}
          reqUrl={getSeriesList(genrePage, network, null, null, genre?.id)}
          hideTitle={true}
          cardType="poster"
          showType="tv"
          page={genrePage}
          onPageChange={setGenrePage}
          infiniteScroll={true}
          resetKey={`${network}:${genre?.id || "all"}`}
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
