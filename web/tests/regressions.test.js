import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import { transformWithEsbuild } from "vite";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const item = (id, updates = {}) => ({ id: `movie:${id}`, tmdbID: id, type: "movie", title: `Film ${id}`, updatedAt: "2026-01-01T00:00:00Z", ...updates });

async function harness(mocks = {}) {
  const storage = new Map();
  const events = new Map();
  const intervals = new Map();
  let timer = 0;
  let now = Date.now();
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    addEventListener: (name, fn) => { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener: (name, fn) => events.get(name)?.delete(fn),
    dispatchEvent: (event) => events.get(event.type)?.forEach((fn) => fn(event)),
    setTimeout: () => ++timer,
    clearTimeout: () => {},
    setInterval: (fn) => { intervals.set(++timer, fn); return timer; },
    clearInterval: (id) => intervals.delete(id),
    location: { href: "https://cineverse.test/" },
  };
  const document = {
    body: { style: {} }, documentElement: { style: {} },
    addEventListener: window.addEventListener, removeEventListener: window.removeEventListener,
  };
  const context = createContext({ window, document, console, URL, Date: ClockDate, CustomEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } } });
  const modules = new Map();
  async function load(identifier) {
    if (modules.has(identifier)) return modules.get(identifier);
    if (Object.hasOwn(mocks, identifier) || identifier.endsWith(".css")) {
      const values = mocks[identifier] || {};
      const module = new SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context, identifier });
      modules.set(identifier, module);
      return module;
    }
    let source = await readFile(identifier, "utf8");
    if (identifier.endsWith(".jsx")) source = (await transformWithEsbuild(source, identifier, { jsx: "automatic" })).code;
    const module = new SourceTextModule(source, { context, identifier });
    modules.set(identifier, module);
    await module.link((specifier, parent) => {
      if (!specifier.startsWith(".")) return load(specifier);
      let resolved = path.resolve(path.dirname(parent.identifier), specifier);
      if (!path.extname(resolved)) resolved += ".js";
      return load(resolved);
    });
    return module;
  }
  return {
    window, intervals, storage,
    advanceTime: (milliseconds) => { now += milliseconds; },
    async import(relative) { const module = await load(path.join(root, relative)); if (module.status !== "evaluated") await module.evaluate(); return module.namespace; },
  };
}

const remotePath = (kind) => path.join(root, `service/${kind}/${kind}Remote.js`);
const watchlistMocks = (overrides = {}) => ({
  getRemoteWatchlist: async () => [], upsertRemoteWatchlist: async () => {},
  upsertRemoteWatchlistItem: async () => {}, deleteRemoteWatchlistItem: async () => true,
  ...overrides,
});

test("late watchlist response cannot enter another account's cache", async () => {
  const pending = deferred();
  const writes = [];
  const h = await harness({ [remotePath("watchlist")]: watchlistMocks({ getRemoteWatchlist: () => pending.promise, upsertRemoteWatchlist: (...args) => writes.push(args) }) });
  const store = await h.import("service/watchlist/watchlistStorage.js");
  const sync = await h.import("service/watchlist/watchlistSync.js");
  store.setActiveWatchlistUser("A");
  const request = sync.syncWatchlistForUser("A");
  store.clearActiveWatchlistUser();
  store.setActiveWatchlistUser("B");
  store.addToWatchlist(item(2));
  pending.resolve([item(1)]);
  await request;
  assert.deepEqual(Array.from(store.getWatchlist(), (entry) => entry.id), ["movie:2"]);
  assert.equal(writes.length, 0);
});

test("sync preserves edits made while its network request is pending", async () => {
  const pending = deferred();
  const h = await harness({ [remotePath("watchlist")]: watchlistMocks({ getRemoteWatchlist: () => pending.promise }) });
  const store = await h.import("service/watchlist/watchlistStorage.js");
  const sync = await h.import("service/watchlist/watchlistSync.js");
  store.setActiveWatchlistUser("A");
  store.addToWatchlist(item(1));
  const request = sync.syncWatchlistForUser("A");
  store.updateWatchlistItem("movie:1", { progressStatus: "Completed" });
  store.addToWatchlist(item(2));
  pending.resolve([item(1)]);
  await request;
  assert.equal(store.getWatchlist().length, 2);
  assert.equal(store.getWatchlist()[0].progressStatus, "Completed");
});

test("offline deletion remains hidden and retries after a new session", async () => {
  let online = false;
  let attempts = 0;
  const h = await harness({ [remotePath("watchlist")]: watchlistMocks({
    getRemoteWatchlist: async () => [item(1)],
    deleteRemoteWatchlistItem: async () => { attempts++; return online; },
  }) });
  const store = await h.import("service/watchlist/watchlistStorage.js");
  const sync = await h.import("service/watchlist/watchlistSync.js");
  store.setActiveWatchlistUser("A");
  store.addToWatchlist(item(1));
  store.removeFromWatchlist("movie:1");
  await assert.rejects(sync.syncWatchlistForUser("A"), /removals/);
  assert.equal(store.getWatchlist().length, 0);
  store.clearActiveWatchlistUser();
  store.setActiveWatchlistUser("A");
  online = true;
  await sync.syncWatchlistForUser("A");
  assert.equal(store.getWatchlist().length, 0);
  assert.ok(attempts >= 3);
  store.addToWatchlist(item(1, { updatedAt: new Date().toISOString() }));
  await sync.syncWatchlistForUser("A");
  assert.equal(store.getWatchlist().length, 1);
});

test("late progress response is discarded even after signing back into the same account", async () => {
  const pending = deferred();
  let writes = 0;
  const h = await harness({ [remotePath("videoProgress")]: {
    getRemoteVideoProgressEntries: () => pending.promise,
    upsertRemoteVideoProgressEntries: async () => { writes++; },
    upsertRemoteVideoProgressEntry: async () => true,
  } });
  const store = await h.import("service/videoProgress/videoProgressStorage.js");
  const sync = await h.import("service/videoProgress/videoProgressSync.js");
  store.setActiveVideoProgressUser("A");
  const request = sync.syncVideoProgressForUser("A");
  store.clearActiveVideoProgressUser();
  store.setActiveVideoProgressUser("A");
  pending.resolve([{ key: "movie:1", seconds: 100 }]);
  await request;
  assert.equal(store.getVideoProgressEntries().length, 0);
  assert.equal(writes, 0);
});

test("player waiting and stale telemetry do not advance progress or complete a title", async () => {
  const effects = [];
  const saves = [];
  let completions = 0;
  let session = "A:1";
  const frame = { contentWindow: { postMessage() {} } };
  const jsx = (type, props) => { if (type === "iframe") props.ref.current = frame; return { type, props }; };
  const mocks = {
    react: { useState: (value) => [value === null ? [{ slug: "test", name: "Test", supported_types: ["movie"], movie_url_template: "https://player.test/{id}" }] : value, () => {}], useRef: (current) => ({ current }), useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn) },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "react-dom": { createPortal: (element) => element },
    [path.join(root, "context/AuthContext.js")]: { useAuth: () => ({ isLoggedIn: true }) },
    [path.join(root, "hooks/useDialogFocus.js")]: { default: () => {} },
    [path.join(root, "service/videoProgress/videoProgressStorage.js")]: {
      getVideoProgressSession: () => session,
      getStoredVideoProgressEntry: () => null,
      setStoredVideoProgress: (keys, seconds) => saves.push(seconds),
      flushStoredVideoProgress: () => {},
    },
  };
  mocks[path.join(root, "service/playerSources/playerSources.js")] = {
    getPlayerSources: async () => [],
    buildPlayerUrl: () => "https://player.test/watch",
  };
  for (const provider of ["videasy", "vidapi", "zxcstream"]) mocks[path.join(root, `service/${provider}/requests.js`)] = { getEmbedUrl: () => "https://player.test/watch" };
  const h = await harness(mocks);
  const { default: Player } = await h.import("components/vidPlayer/VidPlayer.jsx");
  Player({ type: "movie", tmdbID: 1, isOpen: true, runtimeMinutes: 1, onComplete: () => { completions++; } });
  effects.forEach((effect) => effect());
  for (let i = 0; i < 20; i++) { h.advanceTime(10000); h.intervals.forEach((fn) => fn()); }
  assert.equal(saves.length, 0);
  assert.equal(completions, 0);
  const report = (seconds) => h.window.dispatchEvent({ type: "message", source: frame.contentWindow, origin: "https://player.test", data: { currentTime: seconds, duration: 60 } });
  report(10);
  for (let i = 0; i < 20; i++) { h.advanceTime(10000); h.intervals.forEach((fn) => fn()); }
  assert.ok(saves.length > 0);
  assert.ok(saves.every((seconds) => seconds === 10));
  assert.equal(completions, 0);
  report(55);
  assert.equal(completions, 1);
  session = "B:2";
  const count = saves.length;
  report(58);
  h.intervals.forEach((fn) => fn());
  assert.equal(saves.length, count);
});

test("series player waits for Supabase sources and updates episode links", async () => {
  const pending = deferred();
  const states = [];
  const memos = [];
  let stateIndex = 0;
  let memoIndex = 0;
  let effects = [];
  const jsx = (type, props) => ({ type, props });
  const h = await harness({
    react: {
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = value; }];
      },
      useMemo: (fn, deps) => {
        const index = memoIndex++;
        if (!memos[index] || deps.some((value, i) => value !== memos[index].deps[i])) {
          memos[index] = { deps, value: fn() };
        }
        return memos[index].value;
      },
      useRef: (current) => ({ current }), useCallback: (fn) => fn,
      useEffect: (fn) => effects.push(fn),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "react-dom": { createPortal: (element) => element },
    [path.join(root, "context/AuthContext.js")]: { useAuth: () => ({ isLoggedIn: true }) },
    [path.join(root, "hooks/useDialogFocus.js")]: { default: () => {} },
    [path.join(root, "service/videoProgress/videoProgressStorage.js")]: {
      getVideoProgressSession: () => "A:1", getStoredVideoProgressEntry: () => null,
      setStoredVideoProgress: () => {}, flushStoredVideoProgress: () => {},
    },
    [path.join(root, "service/playerSources/playerSources.js")]: {
      getPlayerSources: () => pending.promise,
      buildPlayerUrl: (template, values) => template.replace(/\{(\w+)\}/g, (_, token) => values[token]),
    },
  });
  const { default: Player } = await h.import("components/vidPlayer/VidPlayer.jsx");
  const render = (episode) => {
    stateIndex = 0; memoIndex = 0; effects = [];
    return Player({ type: "tv", tmdbID: 123, season: 2, episode, isOpen: true });
  };
  const findFrame = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === "iframe") return node;
    return [node.props?.children].flat().map(findFrame).find(Boolean);
  };
  assert.equal(findFrame(render(3)), undefined);
  effects[0]();
  pending.resolve([
    { slug: "movies-only", name: "Movies", supported_types: ["movie"], tv_url_template: "https://wrong.test/{id}/{season}/{episode}" },
    { slug: "custom", name: "Custom", supported_types: ["tv"], id_type: "tmdb", tv_url_template: "https://custom.test/{id}/{season}/{episode}" },
  ]);
  await pending.promise;
  await Promise.resolve();
  assert.equal(findFrame(render(3)).props.src, "https://custom.test/123/2/3");
  assert.equal(findFrame(render(4)).props.src, "https://custom.test/123/2/4");
});

test("remote writes serialize bulk sync before a newer edit", async () => {
  const pending = deferred();
  const started = deferred();
  const requests = [];
  const h = await harness({ [path.join(root, "service/supabase/client.js")]: {
    supabase: { from: () => ({ upsert: (rows) => {
      requests.push(rows);
      if (requests.length === 1) { started.resolve(); return pending.promise; }
      return Promise.resolve({ error: null });
    } }) },
  } });
  const remote = await h.import("service/watchlist/watchlistRemote.js");
  const oldWrite = remote.upsertRemoteWatchlist("A", [item(1)]);
  await started.promise;
  const newWrite = remote.upsertRemoteWatchlistItem("A", item(1, { progressStatus: "Completed" }));
  await Promise.resolve();
  assert.equal(requests.length, 1);
  pending.resolve({ error: null });
  await Promise.all([oldWrite, newWrite]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].progress_status, "Completed");
});
