import React, { useEffect, useState } from "react";
import { useFetchApi } from "../../hooks/useFetchApi";
import { getCredits } from "../../service/tmdb/requests";

const Producers = ({ tmdbId }) => {
  const { apiData } = useFetchApi(getCredits("tv", tmdbId), "tmdb");
  const [directors, setDirectors] = useState([]);
  const directorsLength = directors?.length | 0;

  useEffect(() => {
    if (apiData && apiData.crew) {
      const filteredDirectors = apiData.crew.filter(
        (data) => data.known_for_department === "Directing"
      );
      setDirectors(filteredDirectors);
    }
  }, [apiData]);

  return (
    <div>
      <p className="directors">
        Director(s):
        {directors &&
          directors
            .slice(directorsLength - 4, directorsLength)
            .reverse()
            .map((director, index) => (
              <span key={director?.id}>
                {" "}
                {director?.name}
                {index !== directorsLength - 1 ? ", " : ""}
              </span>
            ))}
      </p>
    </div>
  );
};

export default Producers;
