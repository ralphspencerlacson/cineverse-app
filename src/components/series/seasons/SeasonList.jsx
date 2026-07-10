import { useEffect, useMemo, useRef, useState } from "react";
import EpisodeList from "../episodes/EpisodeList";
import "./SeasonList.css";

const easeInOutCubic = (progress) =>
  progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;

const SeasonList = ({
  tmdbID,
  seasons,
  showTitle,
  imdbID,
  initialSeason,
  initialEpisode,
  autoPlayEpisode,
}) => {
  const [curSeason, setCurSeason] = useState(1);
  const sectionRef = useRef(null);
  const streamRef = useRef(null);
  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    pointerId: null,
    startX: 0,
    scrollLeft: 0,
  });
  const programmaticScrollRef = useRef(false);
  const scrollAnimationRef = useRef(null);

  const validSeasons = useMemo(
    () => seasons?.filter((season) => season?.air_date !== null) || [],
    [seasons]
  );

  useEffect(() => {
    // Update the current season when seasons is not empty
    if (validSeasons.length > 0) {
      const hasInitialSeason = validSeasons.some(
        (season) => season?.season_number === Number(initialSeason)
      );
      setCurSeason(hasInitialSeason ? Number(initialSeason) : validSeasons[0]?.season_number);
    }
  }, [initialSeason, validSeasons]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        const visibleSeason = Number(visibleEntry?.target?.dataset?.season);
        if (visibleSeason && !programmaticScrollRef.current) {
          setCurSeason(visibleSeason);
        }
      },
      { root: stream, threshold: [0.35, 0.55, 0.75] }
    );

    stream.querySelectorAll(".episode-list--embedded").forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [validSeasons]);

  const animateStreamTo = (left, duration = 900) => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }

    if (scrollAnimationRef.current) {
      window.cancelAnimationFrame(scrollAnimationRef.current);
    }

    const startLeft = stream.scrollLeft;
    const maxLeft = Math.max(0, stream.scrollWidth - stream.clientWidth);
    const endLeft = Math.min(maxLeft, Math.max(0, left));
    const startedAt = performance.now();

    programmaticScrollRef.current = true;

    const step = (timestamp) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const easedProgress = easeInOutCubic(progress);

      stream.scrollLeft = startLeft + (endLeft - startLeft) * easedProgress;

      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(step);
        return;
      }

      scrollAnimationRef.current = null;
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 120);
    };

    scrollAnimationRef.current = window.requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (scrollAnimationRef.current) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!initialSeason || !validSeasons.length) {
      return;
    }

    let retryCount = 0;
    let timeoutID;

    const centerTargetEpisode = () => {
      const stream = streamRef.current;
      const targetEpisode = Number(initialEpisode || autoPlayEpisode);
      const target = targetEpisode
        ? document.getElementById(`season-${Number(initialSeason)}-episode-${targetEpisode}`)
        : stream?.querySelector(`[data-season="${Number(initialSeason)}"]`);

      if (!stream || !target) {
        retryCount += 1;

        if (retryCount <= 24) {
          timeoutID = window.setTimeout(centerTargetEpisode, 250);
        }

        return;
      }

      const streamRect = stream.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetLeft =
        stream.scrollLeft +
        targetRect.left -
        streamRect.left -
        stream.clientWidth / 2 +
        targetRect.width / 2;

      setCurSeason(Number(initialSeason));
      animateStreamTo(targetLeft, 1100);
    };

    timeoutID = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      centerTargetEpisode();
    }, 450);

    return () => window.clearTimeout(timeoutID);
  }, [autoPlayEpisode, initialEpisode, initialSeason, validSeasons.length]);

  const scrollToSeason = (seasonNumber) => {
    setCurSeason(seasonNumber);
    const stream = streamRef.current;
    const target = stream?.querySelector(`[data-season="${seasonNumber}"]`);

    if (!stream || !target) {
      return;
    }

    const streamRect = stream.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetLeft = stream.scrollLeft + targetRect.left - streamRect.left;

    animateStreamTo(targetLeft, 800);
  };

  const resetDrag = ({ keepMoved = false, pointerId } = {}) => {
    if (dragRef.current.isDragging && pointerId !== undefined) {
      streamRef.current?.releasePointerCapture?.(pointerId);
    }

    dragRef.current = {
      isDragging: false,
      hasMoved: keepMoved ? dragRef.current.hasMoved : false,
      pointerId: null,
      startX: 0,
      scrollLeft: 0,
    };
  };

  const handlePointerDown = (event) => {
    const stream = streamRef.current;
    if (!stream || event.button !== 0) {
      return;
    }

    dragRef.current = {
      isDragging: false,
      hasMoved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: stream.scrollLeft,
    };
  };

  const handlePointerMove = (event) => {
    const stream = streamRef.current;
    if (!stream || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (event.pointerType === "mouse" && event.buttons !== 1) {
      resetDrag({ pointerId: event.pointerId });
      return;
    }

    const deltaX = event.clientX - dragRef.current.startX;
    if (!dragRef.current.isDragging && Math.abs(deltaX) < 6) {
      return;
    }

    if (!dragRef.current.isDragging) {
      dragRef.current.isDragging = true;
      dragRef.current.hasMoved = true;
      stream.setPointerCapture?.(event.pointerId);
    }

    event.preventDefault();
    stream.scrollLeft = dragRef.current.scrollLeft - deltaX;
  };

  const handlePointerUp = (event) => {
    resetDrag({ keepMoved: true, pointerId: event.pointerId });
  };

  const handleClickCapture = (event) => {
    if (!dragRef.current.hasMoved) {
      resetDrag();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resetDrag();
  };

  return (
    <section ref={sectionRef} className="season-list" id="episodes">
      <div className="seasons">
        <ul>
          {validSeasons.map((season) => (
            <li
              key={season?.season_number}
              className={`${season?.season_number === curSeason && "active"}`}
              onClick={() => scrollToSeason(season?.season_number)}
            >
              {season?.name}
            </li>
          ))}
        </ul>
      </div>

      <div
        ref={streamRef}
        className="season-list__episode-stream"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        {validSeasons.map((season) => (
          <EpisodeList
            key={season?.season_number}
            containerID={`episodes-season-${season?.season_number}`}
            tmdbID={tmdbID}
            season={season?.season_number}
            showTitle={showTitle}
            imdbID={imdbID}
            autoPlayEpisode={Number(initialSeason) === Number(season?.season_number) ? autoPlayEpisode : null}
            totalSeasons={validSeasons.length}
            embedded
          />
        ))}
      </div>
    </section>
  );
};

export default SeasonList;
