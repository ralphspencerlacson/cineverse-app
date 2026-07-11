import { useEffect, useState } from "react";
import instance from "../service/tmdb";

export const useNetworkPopularShows = (url) => {
  const [slideData, setSlideData] = useState([]);

  useEffect(() => {
    setIsLoading(true);

    const fetchData = async () => {
      if (!url) {
        return;
      }

      try {
        const res = await instance.get(url);
        const data = await res?.data;

        setApiData(data);
        setIsLoading(false);
      } catch (error) {
        setHasError(error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { isLoading, apiData, hasError };
};
