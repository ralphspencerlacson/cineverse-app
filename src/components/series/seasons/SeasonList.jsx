import { useEffect, useState } from "react";
import EpisodeList from "../episodes/EpisodeList";
import "./SeasonList.css";

const SeasonList = ({ tmdbID, seasons, showTitle, imdbID }) => {
  const [curSeason, setCurSeason] = useState(1);

  useEffect(() => {
    // Update the current season when seasons is not empty
    if (seasons?.length > 0) {
      setCurSeason(seasons[0]?.season_number);
    }
  }, [seasons]);

  return (
    <section className="season-list">
      <div className="seasons">
        <ul>
          {seasons?.map(
            (season) =>
              season?.air_date !== null && (
                <li
                  key={season?.season_number}
                  className={`${
                    season?.season_number === curSeason && "active"
                  }`}
                  onClick={() => setCurSeason(season?.season_number)}
                >
                  {season?.name}
                </li>
              )
          )}
        </ul>
      </div>

      <EpisodeList
        containerID={"episodes"}
        tmdbID={tmdbID}
        season={curSeason}
        showTitle={showTitle}
        imdbID={imdbID}
      />
    </section>
  );
};

export default SeasonList;
