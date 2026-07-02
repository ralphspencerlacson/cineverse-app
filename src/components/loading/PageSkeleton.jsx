import "./PageSkeleton.css";

export const DetailPageSkeleton = () => {
  return (
    <div className="page-skeleton" aria-label="Loading page">
      <div className="page-skeleton__banner shimmer" />

      <div className="page-skeleton__details">
        <div className="page-skeleton__poster shimmer" />
        <div className="page-skeleton__body">
          <div className="page-skeleton__pill shimmer" />
          <div className="page-skeleton__title shimmer" />
          <div className="page-skeleton__actions">
            <div className="page-skeleton__button shimmer" />
            <div className="page-skeleton__button shimmer" />
          </div>
          <div className="page-skeleton__meta shimmer" />
          <div className="page-skeleton__line shimmer" />
          <div className="page-skeleton__line short shimmer" />
          <div className="page-skeleton__chips">
            <span className="shimmer" />
            <span className="shimmer" />
            <span className="shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const ShowDetailsSkeleton = () => {
  return (
    <section className="show-details show-details--loading" aria-label="Loading show details">
      <div className="page-skeleton__details compact">
        <div className="page-skeleton__poster shimmer" />
        <div className="page-skeleton__body">
          <div className="page-skeleton__pill shimmer" />
          <div className="page-skeleton__title shimmer" />
          <div className="page-skeleton__actions">
            <div className="page-skeleton__button shimmer" />
            <div className="page-skeleton__button shimmer" />
          </div>
          <div className="page-skeleton__line shimmer" />
          <div className="page-skeleton__line short shimmer" />
        </div>
      </div>
    </section>
  );
};
