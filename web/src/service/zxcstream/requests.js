const ZXCSTREAM_BASEURL = import.meta.env.VITE_ZXCSTREAM_BASEURL || "https://zxcstream.xyz";
const ZXCSTREAM_THEME_COLOR = "CE3824";

const isNumericId = (value) => /^\d+$/.test(String(value || ""));
const isNumericValue = (value) => /^\d+$/.test(String(value));

const appendQueryParams = (url, params = {}) => {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      queryParams.set(key, String(value));
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `${url}?${queryString}` : url;
};

export const getEmbedUrl = ({
  type,
  tmdbID,
  season,
  episode,
}) => {
  const baseUrl = ZXCSTREAM_BASEURL.replace(/\/+$/, "");
  const params = {
    dubLang: "en",
    server: 1,
    color: ZXCSTREAM_THEME_COLOR,
    autoplay: true,
    back: true,
  };

  if (type === "movie" && isNumericId(tmdbID)) {
    return appendQueryParams(`${baseUrl}/player/movie/${tmdbID}`, params);
  }

  if (
    type === "tv" &&
    isNumericId(tmdbID) &&
    isNumericValue(season) &&
    isNumericValue(episode)
  ) {
    return appendQueryParams(
      `${baseUrl}/player/tv/${tmdbID}/${season}/${episode}`,
      params
    );
  }

  return null;
};
