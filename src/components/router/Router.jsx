import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Components
import Layout from "../../Layout";
import { CineverseLoader } from "../loading/PageSkeleton";

// Lazy-load your pages/components
const HomePage = lazy(() => import("../../pages/homepage/HomePage"));
const MovieList = lazy(() => import("../../pages/movie/MovieList"));
const MoviePage = lazy(() => import("../../pages/movie/MoviePage"));
const SeriesList = lazy(() => import("../../pages/series/SeriesList"));
const SeriesPage = lazy(() => import("../../pages/series/SeriesPage"));
const WatchlistPage = lazy(() => import("../../pages/watchlist/WatchlistPage"));
const NotFound = lazy(() => import("../../pages/notfound/NotFound"));

const Router = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<CineverseLoader label="Loading Cineverse" className="mask" />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/movies" element={<MovieList />} />
            <Route path="/movie/:slug" element={<MoviePage />} />
            <Route path="/series" element={<SeriesList />} />
            <Route path="/series/:slug" element={<SeriesPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default Router;
