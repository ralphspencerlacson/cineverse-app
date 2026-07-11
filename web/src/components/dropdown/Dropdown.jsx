import "./Dropdown.css";

const Dropdown = ({
  options = [],
  selectedOption,
  onChangeOption,
  label = "Browse by Genre",
  allLabel = "All Genres",
}) => {
  const selectedId = selectedOption?.id || null;

  const onSelectOption = (option) => {
    onChangeOption(option?.id === selectedId ? "" : option);
  };

  return (
    <section className="genre-picker" aria-label={label}>
      <div className="genre-picker__header">
        <div>
          <p className="genre-picker__eyebrow">Categories</p>
          <h2>{label}</h2>
        </div>
        <span className="genre-picker__current">
          {selectedOption?.name || allLabel}
        </span>
      </div>

      <div className="genre-picker__rail" role="list">
        <button
          type="button"
          className={`genre-picker__chip ${!selectedId ? "selected" : ""}`}
          onClick={() => onChangeOption("")}
        >
          {allLabel}
        </button>

        {options.map(({ name, id }) => (
          <button
            type="button"
            key={id}
            className={`genre-picker__chip ${id === selectedId ? "selected" : ""}`}
            onClick={() => onSelectOption({ id, name })}
          >
            {name}
          </button>
        ))}
      </div>
    </section>
  );
};

export default Dropdown;
