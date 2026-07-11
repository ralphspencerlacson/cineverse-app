// Syncs local and remote watchlist data, resolving conflicts by newest update time.
import { getRemoteWatchlist, upsertRemoteWatchlist } from "./watchlistRemote";
import { getWatchlist, replaceActiveWatchlist, setActiveWatchlistUser } from "./watchlistStorage";

const WATCHLIST_SYNC_STATUS_KEY_PREFIX = "cineverse-watchlist-sync:";

const getSyncStatusKey = (userID) => `${WATCHLIST_SYNC_STATUS_KEY_PREFIX}${userID}`;

export const getStoredWatchlistSyncStatus = (userID) => {
  if (!userID || typeof window === "undefined") {
    return { state: "idle", syncedAt: null, error: "" };
  }

  try {
    const rawStatus = window.localStorage.getItem(getSyncStatusKey(userID));
    return rawStatus ? JSON.parse(rawStatus) : { state: "idle", syncedAt: null, error: "" };
  } catch {
    return { state: "idle", syncedAt: null, error: "" };
  }
};

const dispatchSyncStatus = (userID, status) => {
  if (typeof window === "undefined") {
    return;
  }

  const nextStatus = { userID, ...status };

  if (userID) {
    window.localStorage.setItem(getSyncStatusKey(userID), JSON.stringify(nextStatus));
  }

  window.dispatchEvent(new CustomEvent("cineverse-watchlist-sync-status", { detail: nextStatus }));
};

const getLatestItem = (firstItem, secondItem) => {
  const firstDate = new Date(firstItem?.updatedAt || firstItem?.addedAt || 0);
  const secondDate = new Date(secondItem?.updatedAt || secondItem?.addedAt || 0);

  return secondDate > firstDate ? secondItem : firstItem;
};

const mergeWatchlistItems = (localItems, remoteItems) => {
  const itemMap = new Map();

  [...localItems, ...remoteItems].forEach((item) => {
    if (!item?.id) {
      return;
    }

    const existingItem = itemMap.get(item.id);
    itemMap.set(item.id, existingItem ? getLatestItem(existingItem, item) : item);
  });

  return Array.from(itemMap.values());
};

export const syncWatchlistForUser = async (userID) => {
  if (!userID) {
    return [];
  }

  setActiveWatchlistUser(userID);
  dispatchSyncStatus(userID, { state: "syncing", error: "" });

  try {
    const localItems = getWatchlist();
    const remoteItems = await getRemoteWatchlist(userID);
    const mergedItems = mergeWatchlistItems(localItems, remoteItems);

    replaceActiveWatchlist(mergedItems);
    await upsertRemoteWatchlist(userID, mergedItems);

    dispatchSyncStatus(userID, {
      state: "synced",
      syncedAt: new Date().toISOString(),
      itemCount: mergedItems.length,
      error: "",
    });

    return mergedItems;
  } catch (error) {
    dispatchSyncStatus(userID, {
      state: "error",
      syncedAt: new Date().toISOString(),
      error: error?.message || "Watchlist sync failed.",
    });
    throw error;
  }
};
