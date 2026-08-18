import { useLocation } from "react-router-dom";

import { parseRoute } from "../lib/router";

export function useRoute() {
  const { pathname } = useLocation();

  return parseRoute(pathname);
}
