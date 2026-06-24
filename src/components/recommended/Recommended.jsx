import React from "react";
import RowContainer from "../containers/RowContainer";
import { getRecommended } from "../../service/tmdb/requests";
import "./Recommended.css";

const Recommended = ({
  type,
  tmdbID,
  tmbdID,
  hasApiResult = null,
  showType,
}) => {
  const resolvedTmdbID = tmdbID || tmbdID;

  if (!resolvedTmdbID) {
    return null;
  }

  return (
    <section className="recommended">
      <RowContainer
        title="More like this"
        reqUrl={getRecommended(type, resolvedTmdbID)}
        cardType="poster"
        showType={showType || type}
        hasApiResult={hasApiResult}
      />
    </section>
  );
};

export default Recommended;
