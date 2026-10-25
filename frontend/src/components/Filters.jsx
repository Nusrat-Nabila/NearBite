
import { useEffect, useMemo, useState } from "react";
import { filterGroups } from "../data/data";
import {
  loadFilterOptions,
  reloadFilterOptions,
} from "../filterOptions";

/* ================= FALLBACK TAGS ================= */

// Shown only until the backend answers, or when it cannot be reached.
const DEFAULT_DIETARY_TAGS = [
  "Halal",
  "Vegetarian",
  "Vegan",
  "Gluten Free",
  "Dairy Free",
];

const DEFAULT_CUISINE_TAGS = [
  "Bengali",
  "Chinese",
  "Thai",
  "Italian",
  "Indian",
  "Arabian",
  "Fast Food",
];

/* ================= HELPERS ================= */

function uniqueItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(item).trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/* ================= FILTER COMPONENT ================= */

// onSeeMore: when given, "See more" opens that page (the cuisines page) instead of
// stretching the list.
export default function Filters({ onFilterChange, onSeeMore }) {
  const [selected, setSelected] = useState({
    Category: ["All"],
  });

  const [openNow, setOpenNow] = useState(false);
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  // The long lists (Category, Cuisine) show 5 items; this holds the ones opened with "See more".
  const [expanded, setExpanded] = useState({});

  // What the backend offers (null until it answers).
  const [options, setOptions] = useState(null);

  /* ================= LOAD OPTIONS FROM THE BACKEND ================= */

  useEffect(() => {
    let active = true;

    const load = (loader) =>
      loader().then((data) => {
        if (active && data) setOptions(data);
      });

    load(loadFilterOptions);

    // The admin may have changed the tags in the meantime.
    const refresh = () => load(reloadFilterOptions);

    window.addEventListener("focus", refresh);
    window.addEventListener("nearbite-tags-updated", refresh);

    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "nearbite-tags-updated",
        refresh
      );
    };
  }, []);

  const cuisineTags = useMemo(
    () =>
      options
        ? options.cuisines.map((item) => item.name)
        : DEFAULT_CUISINE_TAGS,
    [options]
  );

  const categoryTags = useMemo(
    () =>
      options
        ? options.categories.map((item) => item.name)
        : null,
    [options]
  );

  const dietaryTags = useMemo(
    () =>
      options
        ? options.dietary_tags.map((item) => item.name)
        : DEFAULT_DIETARY_TAGS,
    [options]
  );

  /* ================= BUILD FILTER GROUPS ================= */

  const groups = useMemo(() => {
    const originalGroups = Array.isArray(filterGroups)
      ? filterGroups
      : [];

    const otherGroups = originalGroups
      .filter((group) => {
        const title = group.title.toLowerCase();

        return (
          title !== "cuisine" &&
          title !== "cuisines" &&
          title !== "cuisine type" &&
          title !== "dietary" &&
          title !== "dietary tags" &&
          title !== "dietary preferences"
        );
      })
      .map((group) => {
        // Category = what kind of dish (Pizza, Burger, Biryani ...), from the admin's list.
        if (group.title === "Category" && categoryTags) {
          return {
            ...group,
            items: ["All", ...uniqueItems(categoryTags)],
          };
        }

        if (options && group.title === "Meal type") {
          return {
            ...group,
            items: options.meal_types.map((item) => item.label),
          };
        }

        if (options && group.title === "Good for") {
          return {
            ...group,
            items: options.dining_occasions.map(
              (item) => item.label
            ),
          };
        }

        return group;
      });

    return [
      ...otherGroups,
      {
        title: "Cuisine",
        items: uniqueItems(cuisineTags),
        radio: false,
      },
      {
        title: "Dietary Tags",
        items: uniqueItems(dietaryTags),
        radio: false,
      },
    ];
  }, [options, categoryTags, cuisineTags, dietaryTags]);

  /* ================= REMOVE DELETED TAG SELECTIONS ================= */

  useEffect(() => {
    setSelected((previous) => {
      const next = { ...previous };

      const validCuisine = new Set(
        cuisineTags.map((tag) => tag.toLowerCase())
      );

      const validDietary = new Set(
        dietaryTags.map((tag) => tag.toLowerCase())
      );

      next.Cuisine = (previous.Cuisine || []).filter(
        (tag) => validCuisine.has(tag.toLowerCase())
      );

      next["Dietary Tags"] = (
        previous["Dietary Tags"] || []
      ).filter((tag) =>
        validDietary.has(tag.toLowerCase())
      );

      // Before the backend answers, the built-in categories are valid.
      if (categoryTags) {
        const validCategory = new Set(
          categoryTags.map((tag) => tag.toLowerCase())
        );

        const category = previous.Category || ["All"];

        next.Category = category.every(
          (tag) =>
            tag === "All" ||
            validCategory.has(tag.toLowerCase())
        )
          ? category
          : ["All"];
      }

      return next;
    });
  }, [categoryTags, cuisineTags, dietaryTags]);

  /* ================= NOTIFY PARENT ================= */

  useEffect(() => {
    if (typeof onFilterChange === "function") {
      onFilterChange({
        selected,
        minPrice: min,
        maxPrice: max,
        openNow,
      });
    }
  }, [selected, min, max, openNow, onFilterChange]);

  /* ================= TOGGLE FILTER ================= */

  const toggle = (group, item, radio) => {
    setSelected((previous) => {
      const current = previous[group] || [];

      if (radio) {
        return {
          ...previous,
          [group]: [item],
        };
      }

      if (item === "All") {
        return {
          ...previous,
          [group]: ["All"],
        };
      }

      const withoutAll = current.filter(
        (value) => value !== "All"
      );

      const updated = withoutAll.includes(item)
        ? withoutAll.filter((value) => value !== item)
        : [...withoutAll, item];

      return {
        ...previous,
        [group]:
          group === "Category" && updated.length === 0
            ? ["All"]
            : updated,
      };
    });
  };

  /* ================= CLEAR FILTERS ================= */

  const clearAll = () => {
    setSelected({
      Category: ["All"],
    });

    setOpenNow(false);
    setMin("");
    setMax("");
    setExpanded({});
  };

  /* ================= UI ================= */

  return (
    <aside className="filters">
      {/* ================= FILTER HEADER ================= */}

      <div className="filters-head">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>

        <span>Filters</span>

        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* ================= PRICE RANGE ================= */}

      <div className="filter-block">
        <h4>Price range</h4>

        <div className="price-row">
          <input
            type="number"
            min="0"
            value={min}
            onChange={(event) =>
              setMin(event.target.value)
            }
            placeholder="0"
            aria-label="Minimum price"
          />

          <span>To</span>

          <input
            type="number"
            min="0"
            value={max}
            onChange={(event) =>
              setMax(event.target.value)
            }
            placeholder="000"
            aria-label="Maximum price"
          />
        </div>
      </div>

      {/* ================= DYNAMIC FILTER GROUPS ================= */}

      {groups.map((group) => {
        // Category, Cuisine and Dietary Tags can be long: show 5 and a "See more".
        const isLongList =
          group.title === "Category" ||
          group.title === "Cuisine" ||
          group.title === "Dietary Tags";

        // With onSeeMore, the Cuisine "See more" opens the cuisines page.
        const opensPage =
          group.title === "Cuisine" &&
          typeof onSeeMore === "function";

        const showAll = Boolean(expanded[group.title]);

        const allItems = Array.isArray(group.items)
          ? group.items
          : [];

        const items =
          isLongList && !showAll
            ? allItems.slice(0, 5)
            : allItems;

        return (
          <div
            className="filter-block"
            key={group.title}
          >
            <h4>{group.title}</h4>

            {items.map((item) => {
              const active = (
                selected[group.title] || []
              ).includes(item);

              return (
                <label
                  key={item}
                  className={`filter-item ${
                    active ? "active" : ""
                  }`}
                >
                  <input
                    type={
                      group.radio
                        ? "radio"
                        : "checkbox"
                    }
                    name={
                      group.radio
                        ? `filter-${group.title}`
                        : undefined
                    }
                    checked={active}
                    onChange={() =>
                      toggle(
                        group.title,
                        item,
                        group.radio
                      )
                    }
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: 1,
                      height: 1,
                    }}
                  />

                  <span
                    className={`box ${
                      group.radio ? "radio" : ""
                    } ${
                      active ? "box-on" : ""
                    }`}
                    aria-hidden="true"
                  />

                  {item}
                </label>
              );
            })}

            {items.length === 0 && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#888",
                  margin: "8px 0",
                }}
              >
                No tags available.
              </p>
            )}

            {isLongList && allItems.length > 5 && (
              <button
                type="button"
                className="see-more"
                onClick={() => {
                  if (opensPage) {
                    onSeeMore();
                    return;
                  }

                  setExpanded((previous) => ({
                    ...previous,
                    [group.title]: !previous[group.title],
                  }));
                }}
              >
                {showAll && !opensPage ? "See less" : "See more"}
              </button>
            )}
          </div>
        );
      })}

      {/* ================= OPEN NOW ================= */}

      <div className="open-now">
        <div>
          <strong>Open now</strong>
          <small>Show currently open places</small>
        </div>

        <button
          type="button"
          className={`toggle ${
            openNow ? "toggle-on" : ""
          }`}
          onClick={() =>
            setOpenNow((previous) => !previous)
          }
          aria-label="Open now"
          aria-pressed={openNow}
        >
          <span />
        </button>
      </div>

      {/* ================= CLEAR ALL ================= */}

      <button
        type="button"
        className="clear-btn"
        onClick={clearAll}
      >
        Clear all filters
      </button>
    </aside>
  );
}
