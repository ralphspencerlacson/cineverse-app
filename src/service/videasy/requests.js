const VIDEASY_BASEURL = import.meta.env.VITE_VIDEASY_BASEURL;
const VIDEASY_THEME_COLOR = "CE3824";

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

const withProgress = (url, resumeAt = 0, params = {}) => {
  const numericResumeAt = Number(resumeAt);
  const progress =
    Number.isFinite(numericResumeAt) && numericResumeAt > 0
      ? Math.max(0, Math.floor(numericResumeAt))
      : null;

  return appendQueryParams(url, {
    ...params,
    ...(progress ? { progress } : {}),
  });
};

export const getEmbedUrl = ({
  type,
  tmdbID,
  season,
  episode,
  resumeAt,
}) => {
  if (!VIDEASY_BASEURL) {
    return null;
  }

  const baseUrl = VIDEASY_BASEURL.replace(/\/+$/, "");

  if (type === "movie" && isNumericId(tmdbID)) {
    return withProgress(`${baseUrl}/movie/${tmdbID}`, resumeAt, {
      color: VIDEASY_THEME_COLOR,
    });
  }

  if (
    type === "tv" &&
    isNumericId(tmdbID) &&
    isNumericValue(season) &&
    isNumericValue(episode)
  ) {
    return withProgress(`${baseUrl}/tv/${tmdbID}/${season}/${episode}`, resumeAt, {
      nextEpisode: true,
      autoplayNextEpisode: true,
      episodeSelector: true,
      overlay: true,
      color: VIDEASY_THEME_COLOR,
    });
  }

  return null;
};
