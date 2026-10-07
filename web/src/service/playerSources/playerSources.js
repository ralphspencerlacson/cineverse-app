import { supabase } from "../supabase/client";

const TOKENS = new Set(["id", "tmdb_id", "imdb_id", "season", "episode"]);
const TOKEN_PATTERN = /\{([a-z_]+)\}/g;

export const PLAYER_SOURCE_DEFAULTS = [
  { slug: "cinesrc", name: "CineSrc", enabled: true, priority: 10, supported_types: ["movie", "tv"] },
  { slug: "vidapi", name: "VidAPI", enabled: true, priority: 20, supported_types: ["movie", "tv"] },
  { slug: "viduki", name: "Viduki", enabled: true, priority: 30, supported_types: ["movie", "tv"] },
  { slug: "zxcstream", name: "ZXCStream", enabled: true, priority: 40, supported_types: ["movie", "tv"] },
];

export const validatePlayerTemplate = (template, type) => {
  if (!template || typeof template !== "string") return "Enter a player link.";
  let parsed;
  try { parsed = new URL(template); } catch { return "Enter a complete URL starting with https://."; }
  if (parsed.protocol !== "https:") return "Player links must use HTTPS.";
  const tokens = [...template.matchAll(TOKEN_PATTERN)].map((match) => match[1]);
  if (tokens.some((token) => !TOKENS.has(token))) return "Use only the available ID, season, and episode placeholders.";
  if (!tokens.includes("id") && !tokens.includes("tmdb_id") && !tokens.includes("imdb_id")) return "Add an ID placeholder such as {id}.";
  if (type === "tv" && (!tokens.includes("season") || !tokens.includes("episode"))) return "TV links need {season} and {episode}.";
  return null;
};

export const buildPlayerUrl = (template, values = {}) => {
  const error = validatePlayerTemplate(template, values.type);
  if (error) return null;
  return template.replace(TOKEN_PATTERN, (_, token) => encodeURIComponent(values[token] ?? ""));
};

export const getPlayerSources = async () => {
  const { data, error } = await supabase
    .from("player_sources")
    .select("*")
    .eq("enabled", true)
    .order("priority", { ascending: true });
  if (error) throw error;
  return data || [];
};

// Temporary built-in fallback while the CMS table is being populated.
export const getConfiguredPlayerUrl = ({ slug, key, type, tmdbID, imdbID, season, episode, resumeAt }) => {
  slug = slug || key;
  const base = {
    zxcstream: import.meta.env.VITE_ZXCSTREAM_BASEURL || "https://zxcstream.xyz",
    videasy: import.meta.env.VITE_VIDEASY_BASEURL || "https://videasy.net",
    vidapi: import.meta.env.VITE_VIDAPI_BASEURL || "https://vaplayer.ru",
  }[slug]?.replace(/\/+$/, "");
  if (!base) return null;
  const id = imdbID || tmdbID;
  if (!id) return null;
  let url = slug === "zxcstream"
    ? (type === "movie" ? `${base}/player/movie/${tmdbID}` : `${base}/player/tv/${tmdbID}/${season}/${episode}`)
    : (type === "movie" ? `${base}/embed/movie/${id}` : `${base}/embed/tv/${id}/${season}/${episode}`);
  if (slug === "videasy") url += `?color=CE3824${type === "tv" ? "&nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&overlay=true" : ""}`;
  if (slug === "vidapi") url += `${url.includes("?") ? "&" : "?"}autoplay=1`;
  const numericResume = Number(resumeAt);
  if (numericResume > 0 && (slug === "videasy" || slug === "vidapi")) url += `&${slug === "videasy" ? "progress" : "resumeAt"}=${Math.floor(numericResume)}`;
  return url;
};
