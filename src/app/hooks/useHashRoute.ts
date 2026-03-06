import { useEffect, useState } from "react";
import { RouteState } from "../types";

const homeRoute: RouteState = { page: "home" };

function parseRoute(hash: string): RouteState {
  const normalized = hash.replace(/^#/, "");

  if (!normalized || normalized === "/") {
    return homeRoute;
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments[0] === "playlists" && segments[1]) {
    return { page: "playlists", playlistId: segments[1] };
  }

  if (segments[0] === "favorites" || segments[0] === "playlists" || segments[0] === "search" || segments[0] === "home") {
    return { page: segments[0] };
  }

  return homeRoute;
}

function routeToHash(route: RouteState) {
  if (route.page === "playlists" && route.playlistId) {
    return `#/playlists/${route.playlistId}`;
  }

  return route.page === "home" ? "#/home" : `#/${route.page}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseRoute(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);

    if (!window.location.hash) {
      window.location.hash = routeToHash(homeRoute);
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (nextRoute: RouteState) => {
    const nextHash = routeToHash(nextRoute);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute(nextRoute);
    }
  };

  return { route, navigate };
}
