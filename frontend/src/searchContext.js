import { createContext, useContext } from "react";

/* ================= SEARCH BOX ================= */

/*
  What the person typed in the search box of the top bar, shared by every page:
    text      the words searched for (restaurant, dish, cuisine ...)
    location  an area chosen in the "Your Location" box ("" until one is chosen)
    run(text, location)   search: remember them and open the Explore page
    setLocation(area)     remember a chosen area

  And where the customer is (for "near me"), also shared by every page:
    near      { latitude, longitude, label } or null when no position is known
    setNear(position)     remember a position (null forgets it)
*/
export const SearchContext = createContext({
  text: "",
  location: "",
  near: null,
  run: () => {},
  setLocation: () => {},
  setNear: () => {},
});

export const useSearch = () => useContext(SearchContext);
