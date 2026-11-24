import { RouteId } from "../types";

export type SidebarIconKey =
  | "home"
  | "favorites"
  | "search"
  | "history"
  | "profile"
  | "settings"
  | "activity";

export type SidebarNavItem = {
  id: string;
  label: string;
  iconKey: SidebarIconKey;
  route?: RouteId;
  disabled?: boolean;
};

export function getSidebarNavItems(): SidebarNavItem[] {
  return [
    { id: "home", label: "Главная", iconKey: "home", route: "home" },
    { id: "favorites", label: "Избранное", iconKey: "favorites", route: "favorites" },
    { id: "search", label: "Поиск", iconKey: "search", route: "search" },
    { id: "history", label: "История", iconKey: "history", route: "history" },
    { id: "admin", label: "Observatory", iconKey: "activity", route: "admin" },
    { id: "profile", label: "Профиль", iconKey: "profile", disabled: true },
    { id: "settings", label: "Настройки", iconKey: "settings", disabled: true },
  ];
}
