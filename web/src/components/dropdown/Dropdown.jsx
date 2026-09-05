import "./Dropdown.css";

const Dropdown = ({
  options = [],
  selectedOption,
  onChangeOption,
  label = "Browse by Genre",
  allLabel = "All Genres",
}) => {
  const selectedId = selectedOption?.id || null;
  const genreOptions = [{ id: null, name: allLabel }, ...options];
  const selectedIndex = Math.max(0, genreOptions.findIndex(({ id }) => id === selectedId));

  const onSelectOption = (option) => {
    onChangeOption(option?.id === selectedId ? "" : option);
  };

  return (
    <section className="genre-picker" aria-label={label}>
      <div className="genre-picker__header">
        <div>
          <p className="genre-picker__eyebrow">Categories</p>
          <h2>{label}</h2>
          <p className="genre-picker__lede">Set the tone, then explore the cut.</p>
        </div>
        <div className="genre-picker__current" aria-live="polite">
          <span><i aria-hidden="true" /> Mood locked</span>
          <strong>{selectedOption?.name || allLabel}</strong>
          <small>Frame {String(selectedIndex + 1).padStart(2, "0")} / {String(genreOptions.length).padStart(2, "0")}</small>
        </div>
      </div>

      <div className="genre-picker__rail" role="list">
        {genreOptions.map(({ name, id }, index) => (
          <button
            type="button"
            key={id || "all"}
            className={`genre-picker__chip ${id === selectedId ? "selected" : ""}`}
            onClick={() => id ? onSelectOption({ id, name }) : onChangeOption("")}
            aria-pressed={id === selectedId}
          >
            <span className="genre-picker__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span className="genre-picker__name">{name}</span>
            <span className="genre-picker__cue" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default Dropdown;
