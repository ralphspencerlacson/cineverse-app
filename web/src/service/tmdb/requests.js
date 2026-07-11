import networks from '../networks.js';
import instance from './tmdb.js';

export const requests = {
  'getTrending': `/trending/tv/week?language=en-US`,
  'getTopRated': `/discover/tv?include_adult=false&language=en-US&page=1&sort_by=vote_average.desc&vote_count.gte=200`,
  'getMovieTrending': `/trending/movie/week?language=en-US`,
  'getMovieTopRated': `/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=vote_average.desc&vote_count.gte=500`,
};

// Movies
export const getMovieList = (page = 1, sortBy, sortOrder, genre) => {
  const includeAdult = false;
  const includeVideo = true;
  const language = 'en-US';

  let params = `/discover/movie?include_adult=${includeAdult}&include_video=${includeVideo}&language=${language}&page=${page}&sort_by=popularity.desc`;
  if (genre) {
    params += `&with_genres=${genre}`
  }

  return params;
}

// Series
export const getSeriesList = (page = 1, network = 'netflix', sortBy, sortOrder, genre) => {
  const includeAdult = false;
  const includeNullFirstAirDates = false;
  const language = 'en-US';

  let params = `/discover/tv?include_adult=${includeAdult}&include_null_first_air_dates=${includeNullFirstAirDates}&language=${language}&page=${page}`;

  if (sortBy && sortOrder) {
    params += `&sort_by=${sortBy}.${sortOrder}`
  }

  if (genre) {
    params += `&with_genres=${genre}`
  }

  if (network) {
    params += `&with_networks=${networks[network]}`;
  }

  return params;
}

export const getSeriesPopular = () => {
  return `/discover/tv?include_adult=false&language=en-US&page=1&sort_by=popularity.desc`;
}

export const getSeriesSeasons = (id, season, episode = null) => {
  let params = `/tv/${id}/season/${season}`;

  if (episode !== null) {
    params += `/episode/${episode}`;
  }

  return params += `?language=en-US`
}

export const getNetworkDetails = (id) => {
  return `/network/${id}`;
}

// Movies and Series
export const getSeriesTrailers = (type, id) => {
  return `/${type}/${id}/videos?language=en-US`;
}

export const getShowDetails = (type, id) => {
  return `/${type}/${id}?language=en-US`;
}

export const getShowPreview = (type, id) => {
  return `/${type}/${id}?language=en-US&append_to_response=videos`;
}

export const getExternalIds = (type, id) => {
  return `/${type}/${id}/external_ids`;
}

export const getRecommended = (type, id) => {
  return `/${type}/${id}/recommendations?language=en-US&page=1`;
}

export const getCredits = (type, id) => {
  return `/${type}/${id}/aggregate_credits?language=en-US`;
}

export const getMovieCredits = (id) => {
  return `/movie/${id}/credits?language=en-US`;
}

export const getGenres = (type) => {
  return `genre/${type}/list?language=en`;
}

// Person
export const getCast = (id) => {
  return `/person/${id}?language=en-US`;
}

// Other Queries
export const getContentRating = async (type, id) => {

  if (!id) {
    return;
  }

  const parameters = `https://api.themoviedb.org/3/${type}/${id}/content_ratings`;

  try {
    const response = await instance.get(parameters);
    const usIso = response.data.results.find(rating => rating.iso_3166_1 === "US");
    return usIso ? usIso.rating : null;
  } catch (error) {
    console.error('Error fetching content rating:', error);
    return 'Unknown';
  }
}

export const getGenreNames = async (type, id) => {

  if (!id) {
    return;
  }

  const parameters = `https://api.themoviedb.org/3/genre/${type}/list?language=en`;

  try {
    const response = await instance.get(parameters);
    const genre = response.data.genres.find(genre => genre.id === id);
    return genre ? genre.name : 'Unknown';
  } catch (error) {
    console.error('Error fetching genre name:', error);
    return 'Unknown';
  }
}
