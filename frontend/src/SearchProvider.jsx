import { useCallback, useMemo, useState } from "react";

import { SearchContext } from "./searchContext";

// App.jsx listens for this and opens the Explore page.
const SEARCH_EVENT = "nearbite-search";

// The customer's position is kept for the tab, so a reload does not forget it.
const NEAR_KEY = "nearbite-near";

function readNear() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(NEAR_KEY));

    return Number.isFinite(saved?.latitude) &&
      Number.isFinite(saved?.longitude)
      ? saved
      : null;
  } catch {
    return null;
  }
}

export default function SearchProvider({ children }) {
  const [search, setSearch] = useState({
    text: "",
    location: "",
  });

  const [near, setNearState] = useState(readNear);

  const run = useCallback((text, location = "") => {
    setSearch({ text, location });

    window.dispatchEvent(new CustomEvent(SEARCH_EVENT));
  }, []);

  const setLocation = useCallback((location) => {
    setSearch((previous) => ({ ...previous, location }));
  }, []);

  const setNear = useCallback((position) => {
    setNearState(position);

    try {
      if (position) {
        sessionStorage.setItem(NEAR_KEY, JSON.stringify(position));
      } else {
        sessionStorage.removeItem(NEAR_KEY);
      }
    } catch {
      // The position is still kept in memory.
    }
  }, []);

  const value = useMemo(
    () => ({
      text: search.text,
      location: search.location,
      near,
      run,
      setLocation,
      setNear,
    }),
    [search, near, run, setLocation, setNear]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}
