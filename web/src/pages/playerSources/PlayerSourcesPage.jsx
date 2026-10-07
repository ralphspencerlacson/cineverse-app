import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../service/supabase/client";
import { validatePlayerTemplate } from "../../service/playerSources/playerSources";
import "./PlayerSourcesPage.css";

const ADMIN_EMAIL = "admin@memoire.com";
const empty = { name: "", slug: "", enabled: true, priority: 100, supported_types: ["movie", "tv"], movie_url_template: "", tv_url_template: "", id_type: "either", secret_reference: "" };

export default function PlayerSourcesPage() {
  const { user, isAuthLoading } = useAuth();
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const load = async () => {
    const { data } = await supabase.from("player_sources").select("*").order("priority");
    setSources(data || []);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);
  if (isAuthLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    const movieError = form.movie_url_template && validatePlayerTemplate(form.movie_url_template, "movie");
    const tvError = form.tv_url_template && validatePlayerTemplate(form.tv_url_template, "tv");
    if (movieError || tvError) return setMessage(movieError || tvError);
    const payload = { ...form, slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), priority: Number(form.priority) };
    const query = editing ? supabase.from("player_sources").update(payload).eq("id", editing) : supabase.from("player_sources").insert(payload);
    const { error } = await query;
    if (error) return setMessage(error.message);
    setMessage("Player source saved."); setForm(empty); setEditing(null); load();
  };
  const edit = (source) => { setEditing(source.id); setForm({ ...empty, ...source }); setMessage(""); };
  const remove = async (id) => { await supabase.from("player_sources").delete().eq("id", id); load(); };
  const toggleType = (type) => update("supported_types", form.supported_types.includes(type) ? form.supported_types.filter((item) => item !== type) : [...form.supported_types, type]);

  return <main className="player-sources-page"><header><p>Admin settings</p><h1>Player sources</h1><span>Manage where movies and episodes are played.</span></header><section className="player-sources-layout"><form className="player-source-form" onSubmit={save}><h2>{editing ? "Edit player" : "Add a player"}</h2><div className="source-form-row"><label>Player name<input required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Example: VidAPI" /></label><label>ID type<select value={form.id_type} onChange={(e) => update("id_type", e.target.value)}><option value="either">TMDB or IMDb</option><option value="tmdb">TMDB</option><option value="imdb">IMDb</option></select></label><label>Order<input type="number" min="0" value={form.priority} onChange={(e) => update("priority", e.target.value)} /></label></div><label>Movie player link<span className="help">Use {"{id}"}, {"{tmdb_id}"}, or {"{imdb_id}"}.</span><input value={form.movie_url_template || ""} onChange={(e) => update("movie_url_template", e.target.value)} placeholder="https://example.com/movie/{id}" /></label><label>TV episode player link<span className="help">Include {"{season}"} and {"{episode}"}.</span><input value={form.tv_url_template || ""} onChange={(e) => update("tv_url_template", e.target.value)} placeholder="https://example.com/tv/{id}/{season}/{episode}" /></label><fieldset><legend>Works with</legend><label className="check"><input type="checkbox" checked={form.supported_types.includes("movie")} onChange={() => toggleType("movie")} /> Movies</label><label className="check"><input type="checkbox" checked={form.supported_types.includes("tv")} onChange={() => toggleType("tv")} /> TV series</label></fieldset><label className="status-field">Status<select value={form.enabled ? "active" : "disabled"} onChange={(e) => update("enabled", e.target.value === "active")}><option value="active">Active</option><option value="disabled">Disabled</option></select></label><div className="form-actions"><button type="submit">Save player</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>{message && <p className="form-message">{message}</p>}</form><div className="player-source-list"><h2>Configured players</h2>{sources.map((source) => <article key={source.id}><div><strong>{source.name}</strong><span>{source.enabled ? "Active" : "Disabled"} · Priority {source.priority}</span></div><button type="button" onClick={() => edit(source)}>Edit</button><button type="button" onClick={() => remove(source.id)}>Remove</button></article>)}{!sources.length && <p className="help">No players have been added yet.</p>}</div></section></main>;
}
