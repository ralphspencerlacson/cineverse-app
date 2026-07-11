import { useEffect, useState } from "react";
import tmdbInstance from "../service/tmdb/tmdb";
import omdbInstance from "../service/omdb/omdb";

export const useFetchApi = (url, requestFrom) => {
  const [isLoading, setIsLoading] = useState(Boolean(url));
  const [hasError, setHasError] = useState(null);
  const [apiData, setApiData] = useState(null);

  useEffect(() => {
    if (!url || url.includes("undefined")) {
      setIsLoading(false);
      setApiData(null);
      setHasError(null);
      return;
    }

    setIsLoading(true);
    setHasError(null);
    let isCancelled = false;

    const fetchData = async () => {
      try {
        let res;
        if (requestFrom === "tmdb") {
          res = await tmdbInstance.get(url);
        } else if (requestFrom === "omdb") {
          res = await omdbInstance.get(url);
        }

        const data = res?.data;

        if (!isCancelled) {
          setApiData(data);
          setIsLoading(false);
        }
      } catch (error) {
        if (!isCancelled) {
          setHasError(error);
          setIsLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to handle component unmounting
    return () => {
      isCancelled = true;
    };
  }, [url, requestFrom]); // Include requestFrom in the dependency array

  return { isLoading, apiData, hasError };
};
