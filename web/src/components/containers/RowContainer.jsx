import { useEffect } from "react";
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
}) => {
  const { isLoading, hasError, apiData: shows } = useFetchApi(reqUrl, "tmdb");

  useEffect(() => {
    if (hasApiResult && shows?.results.length === 0) {
      hasApiResult(false);
    }
  }, [shows]);

  return (
    <>
      {!hideTitle && <h2 className="row-title">{title}</h2>}
      <div className="row" >
        {hasError && <p>Error fetching data. Please try again later</p>}
        {shows?.total_results === 0 ? (
          <div className="empty-rows">
            <p>{`Currently, there are no shows available in the "${title}" category on this network. Please check back later or explore other categories.`}</p>
          </div>
        ) : isLoading ? (
          <CardSkeleton count={10} layout="row" />
        ) : (
          shows?.results?.map((show) => (
            <ShowCard key={show.id} show={show} cardType={cardType} showType={showType} />
          ))
        )}
      </div>
    </>
  );
};

export default ScrollableRow;
