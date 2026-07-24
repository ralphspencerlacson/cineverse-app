import { useEffect } from "react";
import { useFetchApi } from '../../hooks/useFetchApi';
import ShowCard from '../cards/showCard/ShowCard';
import { CardSkeleton } from '../loading/PageSkeleton';
import "./GridContainer.css";

const ScrollableCollumn = ({
  title,
  reqUrl,
  hideTitle = false,
  cardType,
  showType,
  page,
  onPageChange,
  onLoadComplete,
}) => {
  const { isLoading, hasError, apiData: shows } = useFetchApi(reqUrl, "tmdb");
  const currentPage = Number(page || shows?.page || 1);
  const totalPages = Math.min(Number(shows?.total_pages || 1), 500);
  const showPagination = typeof onPageChange === "function" && totalPages > 1;

  const changePage = (nextPage) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);

    if (boundedPage !== currentPage) {
      onPageChange(boundedPage);
    }
  };

  useEffect(() => {
    const isRequestedPageLoaded = !page || Number(shows?.page) === Number(page);

    if (!isLoading && shows && isRequestedPageLoaded) {
      onLoadComplete?.();
    }
  }, [isLoading, onLoadComplete, page, shows]);

  return (
    <>
      {!hideTitle && <h2 className="row-title">{title}</h2>}
      <div className='grid'>
        {hasError && <p>Error fetching data. Please try again later</p>}
        {
          isLoading ? (
            <CardSkeleton count={10} layout="grid" />
          ) : (
            <div className='wrapper'>
              {shows?.results?.map((show) => (
                <ShowCard key={show.id} show={show} cardType={cardType} showType={showType} />
              ))}
            </div>
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
  )
}

export default ScrollableCollumn
