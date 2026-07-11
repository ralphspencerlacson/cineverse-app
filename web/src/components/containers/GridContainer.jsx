import { useFetchApi } from '../../hooks/useFetchApi';
import ShowCard from '../cards/showCard/ShowCard';
import { CardSkeleton } from '../loading/PageSkeleton';
import "./GridContainer.css";

const ScrollableCollumn = ({
  title,
  reqUrl,
  hideTitle = false,
  cardType,
  showType
}) => {
  const { isLoading, hasError, apiData: shows } = useFetchApi(reqUrl, "tmdb");

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
    </>
  )
}

export default ScrollableCollumn
