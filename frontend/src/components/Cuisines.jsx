
import { useCallback, useEffect, useRef, useState } from "react";
import { cuisines as fallbackCuisines } from "../data/data";
import { pictureFor } from "../cuisinePictures";
import { loadFilterOptions } from "../filterOptions";
import Reveal from "./Reveal";

// Same rule the backend uses to make a slug from a name ("Thai-Chinese" -> "thai-chinese").
const toSlug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-");

// onCuisineSelect(slug): called when a cuisine is clicked (opens the Cuisines page on it).
export default function Cuisines({ onCuisineSelect }) {
  const trackRef = useRef(null);

  // Cuisines from the backend; the built-in list shows until it answers.
  const [items, setItems] = useState(fallbackCuisines);

  // Which arrows to show, worked out from where the row is really scrolled to.
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let active = true;

    loadFilterOptions().then((options) => {
      if (!active || !options?.cuisines?.length) return;

      setItems(
        options.cuisines.map((cuisine) => ({
          name: cuisine.name,
          slug: cuisine.slug,
          image: pictureFor(cuisine.name),
        }))
      );
    });

    return () => {
      active = false;
    };
  }, []);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setCanPrev(track.scrollLeft > 4);
    setCanNext(
      track.scrollLeft + track.clientWidth <
        track.scrollWidth - 4
    );
  }, []);

  // Check again whenever the cuisines change or the row is resized.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    updateArrows();

    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);

    return () => observer.disconnect();
  }, [items, updateArrows]);

  // One "page" = the width of the row, so no cuisine is skipped.
  const slide = (direction) => {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction * Math.max(track.clientWidth * 0.8, 200),
      behavior: "smooth",
    });
  };

  return (
    <section className="section" id="cuisines">
      <Reveal>
        <h2 className="section-title">
          Your favourite cuisines
        </h2>
      </Reveal>

      <div className="cuisine-row">
        {/* Previous button - left of the cuisines */}
        {canPrev && (
          <button
            className="arrow-btn"
            onClick={() => slide(-1)}
            aria-label="Previous cuisines"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="m18 6-6 6 6 6M11 6l-6 6 6 6" />
            </svg>
          </button>
        )}

        {/* Cuisine items  */}
        <div
          className="cuisine-track"
          ref={trackRef}
          onScroll={updateArrows}
        >
          {items.map((c, i) => (
            <Reveal key={c.name} delay={Math.min(i, 8) * 70}>
              <div
                className="cuisine-item"
                role="button"
                tabIndex={0}
                aria-label={`See ${c.name} restaurants`}
                onClick={() =>
                  onCuisineSelect?.(c.slug || toSlug(c.name))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCuisineSelect?.(c.slug || toSlug(c.name));
                  }
                }}
              >
                {c.image ? (
                  <img src={c.image} alt={c.name} />
                ) : (
                  <span
                    className="cuisine-fallback"
                    aria-hidden="true"
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <p>{c.name}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Next button - right of the cuisines */}
        {canNext && (
          <button
            className="arrow-btn"
            onClick={() => slide(1)}
            aria-label="Next cuisines"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="m6 6 6 6-6 6M13 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
