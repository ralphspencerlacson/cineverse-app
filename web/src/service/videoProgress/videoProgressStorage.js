// User-scoped localStorage cache for playback progress with local-first remote writes.
import { upsertRemoteVideoProgressEntry } from "./videoProgressRemote";

export const VIDEO_PROGRESS_STORAGE_KEY = "cineverse-vid-progress";
const VIDEO_PROGRESS_USER_KEY_PREFIX = `${VIDEO_PROGRESS_STORAGE_KEY}:`;
let activeVideoProgressUserID = null;

const isBrowser = () => typeof window !== "undefined";

const getStorageKey = (userID = activeVideoProgressUserID) => {
  return userID ? `${VIDEO_PROGRESS_USER_KEY_PREFIX}${userID}` : VIDEO_PROGRESS_STORAGE_KEY;
};

const readVideoProgressMapFromKey = (storageKey) => {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const writeVideoProgressMapToKey = (storageKey, progressMap) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(progressMap));
};

const normalizeProgressEntry = (value, fallbackKey) => {
  if (typeof value === "number") {
    return {
      key: fallbackKey,
      seconds: Math.floor(value),
      updatedAt: null,
      metadata: null,
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const seconds = Number(value.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return {
    key: value.key || fallbackKey,
    seconds: Math.floor(seconds),
    updatedAt: value.updatedAt || null,
    metadata: value.metadata || null,
  };
};

export const getVideoProgressMap = () => {
  if (!activeVideoProgressUserID) {
    return {};
  }

  return readVideoProgressMapFromKey(getStorageKey());
};

export const setActiveVideoProgressUser = (userID) => {
  activeVideoProgressUserID = userID || null;

  if (!activeVideoProgressUserID || !isBrowser()) {
    return {};
  }

  const userKey = getStorageKey(activeVideoProgressUserID);
  const legacyMap = readVideoProgressMapFromKey(VIDEO_PROGRESS_STORAGE_KEY);

  if (Object.keys(legacyMap).length) {
    writeVideoProgressMapToKey(userKey, {
      ...legacyMap,
      ...readVideoProgressMapFromKey(userKey),
    });
    window.localStorage.removeItem(VIDEO_PROGRESS_STORAGE_KEY);
  }

  return getVideoProgressMap();
};

export const clearActiveVideoProgressUser = () => {
  activeVideoProgressUserID = null;
};

export const getVideoProgressEntries = () => {
  return Object.entries(getVideoProgressMap())
    .map(([key, value]) => normalizeProgressEntry(value, key))
    .filter(Boolean);
};

export const replaceActiveVideoProgress = (entries) => {
  if (!activeVideoProgressUserID || !Array.isArray(entries)) {
    return {};
  }

  const nextMap = {};

  entries.forEach((entry) => {
    const normalizedEntry = normalizeProgressEntry(entry, entry?.key);
    if (!normalizedEntry) {
      return;
    }

    nextMap[normalizedEntry.key] = normalizedEntry;
  });

  try {
    writeVideoProgressMapToKey(getStorageKey(), nextMap);
    window.dispatchEvent(new CustomEvent("cineverse-video-progress", { detail: { entries } }));
  } catch {
    return getVideoProgressMap();
  }

  return nextMap;
};

export const getStoredVideoProgress = (key) => {
  const keys = Array.isArray(key) ? key : [key];
  const map = getVideoProgressMap();

  for (const currentKey of keys) {
    const entry = normalizeProgressEntry(map[currentKey], currentKey);
    if (entry?.seconds > 0) {
      return entry.seconds;
    }
  }

  return 0;
};

export const setStoredVideoProgress = (key, seconds, metadata = null) => {
  const keys = Array.isArray(key) ? key : [key];

  if (!keys.length || !isBrowser() || !activeVideoProgressUserID) {
    return;
  }

  const progress = Number(seconds);
  if (!Number.isFinite(progress) || progress < 1) {
    return;
  }

  const map = getVideoProgressMap();
  const updatedAt = new Date().toISOString();

  for (const currentKey of keys) {
    map[currentKey] = {
      key: currentKey,
      seconds: Math.floor(progress),
      updatedAt,
      metadata,
    };
  }

  try {
    writeVideoProgressMapToKey(getStorageKey(), map);
    keys.forEach((currentKey) => {
      upsertRemoteVideoProgressEntry(activeVideoProgressUserID, map[currentKey]);
    });
    window.dispatchEvent(
      new CustomEvent("cineverse-video-progress", {
        detail: { keys, seconds: Math.floor(progress), metadata },
      })
    );
  } catch {
    return;
  }
};
