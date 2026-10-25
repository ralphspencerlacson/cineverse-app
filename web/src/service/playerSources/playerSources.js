import { supabase } from "../supabase/client";

const TOKENS = new Set(["id", "tmdb_id", "imdb_id", "season", "episode"]);
const TOKEN_PATTERN = /\{([a-z_]+)\}/g;

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

