import { useEffect, useState } from "react";
import { parseRoute } from "../lib/router";

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.pathname));

    window.addEventListener("popstate", update);

    return () => window.removeEventListener("popstate", update);
  }, []);

  return route;
}
