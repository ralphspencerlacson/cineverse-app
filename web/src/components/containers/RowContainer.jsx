import { useEffect, useRef, useState } from "react";
import ShowCard from "../cards/showCard/ShowCard.jsx";
import { CardSkeleton } from "../loading/PageSkeleton.jsx";
// Hooks
import { useFetchApi } from "../../hooks/useFetchApi.jsx";
// CSS
import "./RowContainer.css";

const ScrollableRow = ({
  title,
  reqUrl,
  hideTitle = false,
  cardType,
  showType,
  hasApiResult,
  page,
  onPageChange,
  infiniteScroll = false,
  resetKey,
}) => {
  const rowRef = useRef(null);
  const { isLoading, hasError, apiData: shows } = useFetchApi(reqUrl, "tmdb");
  const [loadedShows, setLoadedShows] = useState([]);
  const currentPage = Number(page || shows?.page || 1);
  const totalPages = Math.min(Number(shows?.total_pages || 1), 500);
  const canChangePage = typeof onPageChange === "function" && totalPages > 1;
  const showPagination = canChangePage && !infiniteScroll;
  const visibleShows = infiniteScroll ? loadedShows : shows?.results;

  const changePage = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);

    if (boundedPage !== currentPage) {
      onPageChange(boundedPage);
    }
  };

  useEffect(() => {
    if (hasApiResult && shows?.results.length === 0) {
      hasApiResult(false);
    }
  }, [shows]);

  useEffect(() => {
    if (!infiniteScroll) {
      return;
    }

    setLoadedShows([]);
    if (rowRef.current) {
      rowRef.current.scrollLeft = 0;
    }
  }, [infiniteScroll, resetKey]);

  useEffect(() => {
    if (!infiniteScroll || !Array.isArray(shows?.results)) {
      return;
    }

    const dataPage = Number(shows?.page || currentPage);

    setLoadedShows((currentShows) => {
      if (dataPage <= 1) {
        return shows.results;
      }

      const existingIDs = new Set(currentShows.map((show) => show.id));
      const nextShows = shows.results.filter((show) => !existingIDs.has(show.id));

      return [...currentShows, ...nextShows];
    });
  }, [currentPage, infiniteScroll, shows]);

  const handleScroll = (event) => {
    if (!infiniteScroll || !canChangePage || isLoading || currentPage >= totalPages) {
      return;
    }

    const { clientWidth, scrollLeft, scrollWidth } = event.currentTarget;
    const isNearEnd = scrollLeft + clientWidth >= scrollWidth - 300;

    if (isNearEnd) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <>
      {!hideTitle && <h2 className="row-title">{title}</h2>}
      <div className="row" ref={rowRef} onScroll={handleScroll}>
        {hasError && <p>Error fetching data. Please try again later</p>}
        {shows?.total_results === 0 ? (
          <div className="empty-rows">
            <p>{`Currently, there are no shows available in the "${title}" category on this network. Please check back later or explore other categories.`}</p>
          </div>
        ) : isLoading && (!infiniteScroll || loadedShows.length === 0) ? (
          <CardSkeleton count={10} layout="row" />
        ) : (
          visibleShows?.map((show) => (
            <ShowCard key={show.id} show={show} cardType={cardType} showType={showType} />
          ))
        )}
        {infiniteScroll && isLoading && loadedShows.length > 0 && (
          <CardSkeleton count={4} layout="row" />
        )}
      </div>
      {showPagination && (
        <div className="pagination" aria-label={`${title} pagination`}>
          <button
            type="button"
            className="pagination__button"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            Previous
          </button>
          <span className="pagination__status">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="pagination__button"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
};

export default ScrollableRow;
