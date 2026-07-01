const VIDAPI_BASEURL = import.meta.env.VITE_VIDAPI_BASEURL;

const isNumericId = (value) => /^\d+$/.test(String(value || ""));
const isNumericValue = (value) => /^\d+$/.test(String(value));

const appendAutoplay = (url, resumeAt = 0) => {
  if (!url) {
    return "";
  }

  let output = `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;

  const numericResumeAt = Number(resumeAt);
  if (Number.isFinite(numericResumeAt) && numericResumeAt > 0) {
    output += `&resumeAt=${Math.max(0, Math.floor(numericResumeAt))}`;
  }

  return output;
};

export const getEmbedUrl = ({
  type,
  tmdbID,
  imdbID,
  season,
  episode,
  resumeAt,
}) => {
  if (!VIDAPI_BASEURL) {
    return null;
  }

  const baseUrl = VIDAPI_BASEURL.replace(/\/+$/, "");

  if (type === "movie") {
    if (imdbID) {
      return appendAutoplay(
        `${baseUrl}/embed/movie?imdb=${imdbID}`,
        resumeAt
      );
    }

    if (isNumericId(tmdbID)) {
      return appendAutoplay(`${baseUrl}/embed/movie/${tmdbID}`, resumeAt);
    }
  }

  if (type === "tv") {
    if (imdbID && isNumericValue(season) && isNumericValue(episode)) {
      return appendAutoplay(
        `${baseUrl}/embed/tv?imdb=${imdbID}&season=${season}&episode=${episode}`,
        resumeAt
      );
    }

    if (
      isNumericId(tmdbID) &&
      isNumericValue(season) &&
      isNumericValue(episode)
    ) {
      return appendAutoplay(
        `${baseUrl}/embed/tv/${tmdbID}/${season}/${episode}`,
        resumeAt
      );
    }
  }

  return null;
};
