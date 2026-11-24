import { useEffect, useState } from "react";
import { RouteState } from "../types";

const homeRoute: RouteState = { page: "home" };

export function parseRoute(hash: string): RouteState {
  const normalized = hash.replace(/^#/, "");

  if (!normalized || normalized === "/") {
    return homeRoute;
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments[0] === "playlists" && segments[1]) {
    return { page: "playlists", playlistId: segments[1] };
  }

  if (segments[0] === "artists" && segments[1]) {
    if (segments[2] === "releases" && segments[3]) {
      return { page: "release", artistId: segments[1], releaseId: segments[3] };
    }

    return { page: "artist", artistId: segments[1] };
  }

  if (segments[0] === "releases" && segments[1]) {
    return { page: "release", releaseId: segments[1] };
  }

  if (segments[0] === "admin") {
    if (segments[1] === "recommendations") {
      return segments[2]
        ? {
            page: "admin",
            adminSection: "recommendations",
            adminRequestId: segments[2],
          }
        : {
            page: "admin",
            adminSection: "recommendations",
          };
    }

    if (segments[1] === "discovery" && segments[2] === "jobs") {
      return segments[3]
        ? {
            page: "admin",
            adminSection: "discovery",
            adminJobId: segments[3],
          }
        : {
            page: "admin",
            adminSection: "discovery",
          };
    }

    if (segments[1] === "users") {
      return segments[2]
        ? {
            page: "admin",
            adminSection: "profile",
            adminUserId: segments[2],
          }
        : {
            page: "admin",
            adminSection: "profile",
          };
    }

    return { page: "admin", adminSection: "recommendations" };
  }

  if (
    segments[0] === "favorites" ||
    segments[0] === "playlists" ||
    segments[0] === "search" ||
    segments[0] === "history" ||
    segments[0] === "login" ||
    segments[0] === "register" ||
    segments[0] === "admin" ||
    segments[0] === "home"
  ) {
    return { page: segments[0] };
  }

  return homeRoute;
}

export function routeToHash(route: RouteState) {
  if (route.page === "playlists" && route.playlistId) {
    return `#/playlists/${route.playlistId}`;
  }

  if (route.page === "artist" && route.artistId) {
    return `#/artists/${route.artistId}`;
  }

  if (route.page === "release" && route.releaseId) {
    if (route.artistId) {
      return `#/artists/${route.artistId}/releases/${route.releaseId}`;
    }

    return `#/releases/${route.releaseId}`;
  }

  if (route.page === "admin") {
    if (route.adminSection === "discovery") {
      return route.adminJobId
        ? `#/admin/discovery/jobs/${route.adminJobId}`
        : "#/admin/discovery/jobs";
    }

    if (route.adminSection === "profile") {
      return route.adminUserId ? `#/admin/users/${route.adminUserId}` : "#/admin/users";
    }

    return route.adminRequestId
      ? `#/admin/recommendations/${route.adminRequestId}`
      : "#/admin/recommendations";
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
