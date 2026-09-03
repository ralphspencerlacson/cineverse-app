// User-scoped localStorage cache for playback progress with local-first remote writes.
import { upsertRemoteVideoProgressEntry } from "./videoProgressRemote";

export const VIDEO_PROGRESS_STORAGE_KEY = "cineverse-vid-progress";
const VIDEO_PROGRESS_USER_KEY_PREFIX = `${VIDEO_PROGRESS_STORAGE_KEY}:`;
const WRITE_THROTTLE_MS = 5000;
let activeVideoProgressUserID = null;
const pendingLocalMaps = new Map();
const pendingRemoteEntries = new Map();
let localFlushTimeout = null;
let remoteFlushTimeout = null;
let remoteFlushPromise = null;

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

const flushLocalProgress = () => {
  if (localFlushTimeout) {
    window.clearTimeout(localFlushTimeout);
    localFlushTimeout = null;
  }

  pendingLocalMaps.forEach((progressMap, storageKey) => {
    try {
      writeVideoProgressMapToKey(storageKey, progressMap);
      pendingLocalMaps.delete(storageKey);
    } catch {
      // Keep the latest map queued so a later write can retry it.
    }
  });
};

const flushRemoteProgress = async () => {
  if (remoteFlushTimeout) {
    window.clearTimeout(remoteFlushTimeout);
    remoteFlushTimeout = null;
  }

  if (remoteFlushPromise || !pendingRemoteEntries.size) {
    return remoteFlushPromise;
  }

  const entries = Array.from(pendingRemoteEntries.values());
  entries.forEach(({ userID, entry }) => {
    pendingRemoteEntries.delete(`${userID}:${entry.key}`);
  });

  remoteFlushPromise = Promise.all(
    entries.map(async ({ userID, entry }) => ({
      userID,
      entry,
      succeeded: await upsertRemoteVideoProgressEntry(userID, entry),
    }))
  ).then((results) => {
    results.forEach(({ userID, entry, succeeded }) => {
      const pendingKey = `${userID}:${entry.key}`;
      if (!succeeded && !pendingRemoteEntries.has(pendingKey)) {
        pendingRemoteEntries.set(pendingKey, { userID, entry });
      }
    });
  }).finally(() => {
    remoteFlushPromise = null;
    if (pendingRemoteEntries.size) {
      remoteFlushTimeout = window.setTimeout(flushRemoteProgress, WRITE_THROTTLE_MS);
    }
  });

  return remoteFlushPromise;
};

const scheduleProgressFlush = () => {
  if (!localFlushTimeout) {
    localFlushTimeout = window.setTimeout(flushLocalProgress, WRITE_THROTTLE_MS);
  }
  if (!remoteFlushTimeout && !remoteFlushPromise) {
    remoteFlushTimeout = window.setTimeout(flushRemoteProgress, WRITE_THROTTLE_MS);
  }
};

const normalizeProgressEntry = (value, fallbackKey) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

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
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return {
    ...value,
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

  const storageKey = getStorageKey();
  return pendingLocalMaps.get(storageKey) || readVideoProgressMapFromKey(storageKey);
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

export const replaceActiveVideoProgress = (entries, { mergeCurrent = false } = {}) => {
  if (!activeVideoProgressUserID || !Array.isArray(entries)) {
    return {};
  }

  const nextMap = mergeCurrent ? { ...getVideoProgressMap() } : {};

  entries.forEach((entry) => {
    const normalizedEntry = normalizeProgressEntry(entry, entry?.key);
    if (!normalizedEntry) {
      return;
    }

    const existingEntry = normalizeProgressEntry(
      nextMap[normalizedEntry.key],
      normalizedEntry.key
    );
    const existingDate = new Date(existingEntry?.updatedAt || 0);
    const nextDate = new Date(normalizedEntry.updatedAt || 0);

    if (!existingEntry || nextDate > existingDate) {
      nextMap[normalizedEntry.key] = normalizedEntry;
    }
  });

  try {
    const storageKey = getStorageKey();
    writeVideoProgressMapToKey(storageKey, nextMap);
    pendingLocalMaps.delete(storageKey);
    window.dispatchEvent(new CustomEvent("cineverse-video-progress", { detail: { entries } }));
  } catch {
    return getVideoProgressMap();
  }

  return nextMap;
};

export const getStoredVideoProgress = (key) => {
  return getStoredVideoProgressEntry(key)?.seconds || 0;
};

export const getStoredVideoProgressEntry = (key) => {
  const keys = Array.isArray(key) ? key : [key];
  const map = getVideoProgressMap();
  let latestEntry = null;

  for (const currentKey of keys) {
    const entry = normalizeProgressEntry(map[currentKey], currentKey);
    if (!entry) {
      continue;
    }

    const entryDate = new Date(entry.updatedAt || 0);
    const latestDate = new Date(latestEntry?.updatedAt || 0);
    if (!latestEntry || entryDate > latestDate) {
      latestEntry = entry;
    }
  }

  return latestEntry;
};

export const setStoredVideoProgress = (
  key,
  seconds,
  metadata = null,
  { flushLocal = false, preserveUpdatedAt = false } = {}
) => {
  const keys = Array.isArray(key) ? key : [key];

  if (!keys.length || !isBrowser() || !activeVideoProgressUserID) {
    return;
  }

  const progress = Number(seconds);
  if (!Number.isFinite(progress) || progress < 0) {
    return;
  }

  const map = getVideoProgressMap();
  const updatedAt = new Date().toISOString();

  for (const currentKey of keys) {
    const existingEntry = normalizeProgressEntry(map[currentKey], currentKey);
    map[currentKey] = {
      ...(existingEntry || {}),
      key: currentKey,
      seconds: Math.floor(progress),
      updatedAt: preserveUpdatedAt && existingEntry?.updatedAt
        ? existingEntry.updatedAt
        : updatedAt,
      metadata: {
        ...(existingEntry?.metadata || {}),
        ...(metadata || {}),
      },
    };
    pendingRemoteEntries.set(`${activeVideoProgressUserID}:${currentKey}`, {
      userID: activeVideoProgressUserID,
      entry: map[currentKey],
    });
  }

  try {
    pendingLocalMaps.set(getStorageKey(), map);
    scheduleProgressFlush();
    if (flushLocal) {
      flushLocalProgress();
    }
    window.dispatchEvent(
      new CustomEvent("cineverse-video-progress", {
        detail: { keys, seconds: Math.floor(progress), metadata },
      })
    );
  } catch {
    return;
  }
};

export const flushStoredVideoProgress = () => {
  if (!isBrowser()) {
    return;
  }

  flushLocalProgress();
  flushRemoteProgress();
};
