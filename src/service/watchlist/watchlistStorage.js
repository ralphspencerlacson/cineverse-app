// User-scoped localStorage cache for watchlist items with local-first remote writes.
import {
  deleteRemoteWatchlistItem,
  upsertRemoteWatchlistItem,
} from "./watchlistRemote";

export const WATCHLIST_STORAGE_KEY = "cineverse-watchlist";
const WATCHLIST_USER_KEY_PREFIX = `${WATCHLIST_STORAGE_KEY}:`;
let activeWatchlistUserID = null;

export const WATCH_STATUS_OPTIONS = [
  "Planned",
  "Ongoing",
  "Completed",
  "Dropped",
];

const isBrowser = () => typeof window !== "undefined";

const getStorageKey = (userID = activeWatchlistUserID) => {
  return userID ? `${WATCHLIST_USER_KEY_PREFIX}${userID}` : WATCHLIST_STORAGE_KEY;
};

const readWatchlistFromKey = (storageKey) => {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeWatchlistToKey = (storageKey, items) => {
  if (!isBrowser() || !Array.isArray(items)) {
    return [];
  }

  const normalizedItems = items.map(normalizeItem).filter(Boolean);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizedItems));
  } catch {
    return readWatchlistFromKey(storageKey);
  }

  return normalizedItems;
};

const normalizeItem = (item) => {
  if (!item || !item.id || !item.tmdbID || !item.type || !item.title) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    progressStatus: "Planned",
    currentSeason: item.type === "tv" ? 1 : null,
    currentEpisode: item.type === "tv" ? 1 : null,
    addedAt: now,
    updatedAt: now,
    ...item,
  };
};

export const getWatchlist = () => {
  if (!activeWatchlistUserID) {
    return [];
  }

  return readWatchlistFromKey(getStorageKey());
};

export const saveWatchlist = (items) => {
  if (!activeWatchlistUserID) {
    return [];
  }

  return writeWatchlistToKey(getStorageKey(), items);
};

export const setActiveWatchlistUser = (userID) => {
  activeWatchlistUserID = userID || null;

  if (!activeWatchlistUserID || !isBrowser()) {
    return [];
  }

  const userKey = getStorageKey(activeWatchlistUserID);
  const legacyItems = readWatchlistFromKey(WATCHLIST_STORAGE_KEY);

  if (legacyItems.length) {
    const itemMap = new Map(readWatchlistFromKey(userKey).map((item) => [item.id, item]));

    legacyItems.forEach((legacyItem) => {
      const normalizedItem = normalizeItem(legacyItem);
      if (!normalizedItem) {
        return;
      }

      const existingItem = itemMap.get(normalizedItem.id);
      if (!existingItem) {
        itemMap.set(normalizedItem.id, normalizedItem);
        return;
      }

      const existingDate = new Date(existingItem.updatedAt || existingItem.addedAt || 0);
      const legacyDate = new Date(normalizedItem.updatedAt || normalizedItem.addedAt || 0);
      itemMap.set(normalizedItem.id, legacyDate > existingDate ? normalizedItem : existingItem);
    });

    writeWatchlistToKey(userKey, Array.from(itemMap.values()));
    window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
  }

  return getWatchlist();
};

export const clearActiveWatchlistUser = () => {
  activeWatchlistUserID = null;
};

export const replaceActiveWatchlist = (items) => {
  const savedItems = saveWatchlist(items);

  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("cineverse-watchlist-sync", { detail: { items: savedItems } }));
  }

  return savedItems;
};

export const isInWatchlist = (id) => {
  return getWatchlist().some((item) => item.id === id);
};

export const addToWatchlist = (item) => {
  const normalizedItem = normalizeItem(item);
  if (!normalizedItem) {
    return getWatchlist();
  }

  const items = getWatchlist();
  const existingItem = items.find((currentItem) => currentItem.id === normalizedItem.id);

  if (existingItem) {
    return items;
  }

  const nextItems = saveWatchlist([...items, normalizedItem]);
  upsertRemoteWatchlistItem(activeWatchlistUserID, normalizedItem);
  return nextItems;
};

export const removeFromWatchlist = (id) => {
  const nextItems = saveWatchlist(getWatchlist().filter((item) => item.id !== id));
  deleteRemoteWatchlistItem(activeWatchlistUserID, id);
  return nextItems;
};

export const updateWatchlistItem = (id, updates) => {
  const updatedAt = new Date().toISOString();
  const items = getWatchlist().map((item) =>
    item.id === id ? { ...item, ...updates, updatedAt } : item
  );

  const nextItems = saveWatchlist(items);
  const updatedItem = nextItems.find((item) => item.id === id);
  upsertRemoteWatchlistItem(activeWatchlistUserID, updatedItem);
  return nextItems;
};

export const syncWatchlistItemMetadata = (id, metadata) => {
  if (!id || !metadata) {
    return getWatchlist();
  }

  let didChange = false;
  const items = getWatchlist().map((item) => {
    if (item.id !== id) {
      return item;
    }

    const currentTotalSeasons = Number(item.totalSeasons || 0);
    const currentTotalEpisodes = Number(item.totalEpisodes || 0);
    const nextTotalSeasons = Number(metadata.totalSeasons || currentTotalSeasons);
    const nextTotalEpisodes = Number(metadata.totalEpisodes || currentTotalEpisodes);
    const hasNewSeriesContent =
      item.type === "tv" &&
      item.progressStatus === "Completed" &&
      (nextTotalSeasons > currentTotalSeasons || nextTotalEpisodes > currentTotalEpisodes);

    const nextItem = {
      ...item,
      ...metadata,
      ...(hasNewSeriesContent ? { progressStatus: "Planned" } : {}),
    };

    didChange =
      didChange ||
      hasNewSeriesContent ||
      Object.keys(metadata).some((key) => item[key] !== metadata[key]);

    return nextItem;
  });

  if (!didChange) {
    return getWatchlist();
  }

  const nextItems = saveWatchlist(items);
  const syncedItem = nextItems.find((item) => item.id === id);
  upsertRemoteWatchlistItem(activeWatchlistUserID, syncedItem);
  return nextItems;
};

export const mergeWatchlist = (incomingItems) => {
  if (!Array.isArray(incomingItems)) {
    return getWatchlist();
  }

  const itemMap = new Map(getWatchlist().map((item) => [item.id, item]));

  incomingItems.forEach((incomingItem) => {
    const normalizedItem = normalizeItem(incomingItem);
    if (!normalizedItem) {
      return;
    }

    const existingItem = itemMap.get(normalizedItem.id);
    if (!existingItem) {
      itemMap.set(normalizedItem.id, normalizedItem);
      return;
    }

    const existingDate = new Date(existingItem.updatedAt || existingItem.addedAt || 0);
    const incomingDate = new Date(normalizedItem.updatedAt || normalizedItem.addedAt || 0);
    itemMap.set(
      normalizedItem.id,
      incomingDate > existingDate ? normalizedItem : existingItem
    );
  });

  const nextItems = saveWatchlist(Array.from(itemMap.values()));
  nextItems.forEach((item) => upsertRemoteWatchlistItem(activeWatchlistUserID, item));
  return nextItems;
};
