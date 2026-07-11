// Supabase persistence for playback progress and the latest watched pointer.
import { supabase } from "../supabase/client";
import { fromVideoProgressRow, toVideoProgressRow } from "./videoProgressMappers";

const VIDEO_PROGRESS_TABLE = "video_progress";
const VIDEO_LAST_WATCHED_TABLE = "video_last_watched";

const updateLastWatched = async (userID, progressRow) => {
  if (!userID || !progressRow?.id) {
    return;
  }

  const { error } = await supabase
    .from(VIDEO_LAST_WATCHED_TABLE)
    .upsert(
      {
        user_id: userID,
        video_progress_id: progressRow.id,
        watched_at: progressRow.updated_at || new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Failed to update remote last watched", error);
  }
};

export const getRemoteVideoProgressEntries = async (userID) => {
  if (!userID) {
    return [];
  }

  const { data, error } = await supabase
    .from(VIDEO_PROGRESS_TABLE)
    .select("*")
    .eq("user_id", userID)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to load remote video progress", error);
    throw error;
  }

  return (data || []).map(fromVideoProgressRow).filter(Boolean);
};

export const upsertRemoteVideoProgressEntry = async (userID, entry) => {
  const remoteProgress = toVideoProgressRow(userID, entry);
  if (!remoteProgress) {
    return;
  }

  const { data, error } = await supabase
    .from(VIDEO_PROGRESS_TABLE)
    .upsert(remoteProgress, {
      onConflict: "user_id,content_type,tmdb_id,season_number,episode_number",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to save remote video progress", error);
    return;
  }

  await updateLastWatched(userID, data);
};

export const upsertRemoteVideoProgressEntries = async (userID, entries) => {
  if (!userID || !Array.isArray(entries) || !entries.length) {
    return;
  }

  const rows = entries.map((entry) => toVideoProgressRow(userID, entry)).filter(Boolean);
  if (!rows.length) {
    return;
  }

  const { data, error } = await supabase
    .from(VIDEO_PROGRESS_TABLE)
    .upsert(rows, {
      onConflict: "user_id,content_type,tmdb_id,season_number,episode_number",
    })
    .select("*");

  if (error) {
    console.error("Failed to save remote video progress", error);
    throw error;
  }

  const latestProgressRow = (data || []).sort(
    (firstRow, secondRow) =>
      new Date(secondRow.updated_at || 0) - new Date(firstRow.updated_at || 0)
  )[0];

  await updateLastWatched(userID, latestProgressRow);
};
