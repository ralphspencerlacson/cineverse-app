const OMDB_TOKEN = import.meta.env.VITE_OMDB_TOKEN;

export const getSeriesMoreInfo = (id) => {
    return `?apikey=${OMDB_TOKEN}&i=${id}&plot=full`;
  }