import { useEffect, useState } from "react";
import EpisodeList from "../episodes/EpisodeList";
import "./SeasonList.css";

const SeasonList = ({
  tmdbID,
  seasons,
  showTitle,
  imdbID,
  initialSeason,
  autoPlayEpisode,
}) => {
  const [curSeason, setCurSeason] = useState(1);

  useEffect(() => {
    // Update the current season when seasons is not empty
    if (seasons?.length > 0) {
      const hasInitialSeason = seasons.some(
        (season) => season?.season_number === Number(initialSeason)
      );
      setCurSeason(hasInitialSeason ? Number(initialSeason) : seasons[0]?.season_number);
    }
  }, [initialSeason, seasons]);

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
        autoPlayEpisode={autoPlayEpisode}
      />
    </section>
  );
};

export default SeasonList;
