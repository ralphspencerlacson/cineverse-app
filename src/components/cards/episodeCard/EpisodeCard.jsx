import { useState } from "react";
import NoImagePlaceholder from "../../../assets/png/no_image_placeholder.png";
import VidPlayer from "../../vidPlayer/VidPlayer";
import "./EpisodeCard.css";

const TMDB_ASSET_BASEURL = import.meta.env.VITE_TMDB_ASSET_BASEURL;

const EpisodeCard = ({
  episode,
  defaultImage,
  tmdbID,
  season,
  showTitle,
  imdbID,
}) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const getCoverUrl = () => {
    const episodeCover =
      episode.still_path !== "" ? episode.still_path : defaultImage;
    return episodeCover === null
      ? NoImagePlaceholder
      : TMDB_ASSET_BASEURL + episodeCover;
  };

  return (
    <div
      key={episode.episode_number}
      className="episode-card"
      role="button"
      tabIndex={0}
      onClick={() => setIsPlayerOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          setIsPlayerOpen(true);
        }
      }}
      style={{
        backgroundImage: `url(${getCoverUrl()})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
      }}
    >
      <div className="overlay">
        <h4 className="number">{episode.episode_number}</h4>
        <p className="title">{episode.name}</p>
        <p className="overview">{episode.overview}</p>

        <VidPlayer
          showButton={false}
          type="tv"
          tmdbID={tmdbID}
          imdbID={imdbID}
          season={season}
          episode={episode.episode_number}
          isOpen={isPlayerOpen}
          onOpenChange={setIsPlayerOpen}
          title={`${showTitle ? `${showTitle} - ` : ""}S${season}E${episode.episode_number}`}
        />
      </div>
    </div>
  );
};

export default EpisodeCard;
