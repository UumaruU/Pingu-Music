import { Heart, House, ListMusic } from "lucide-react";
import { RouteId } from "../types";
import { BrandMark } from "./BrandMark";

interface SidebarProps {
  activePage: RouteId;
  onNavigate: (route: RouteId) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const navItems: Array<{ id: RouteId; label: string; icon: typeof House; hint: string }> = [
    { id: "home", label: "Главная", icon: House, hint: "Популярное и подборки" },
    { id: "favorites", label: "Избранное", icon: Heart, hint: "Автозагрузка и сохранённое" },
    { id: "playlists", label: "Плейлисты", icon: ListMusic, hint: "Ваши подборки" },
  ];

  return (
    <aside className="scrollbar-none sticky top-0 hidden h-screen w-[290px] shrink-0 overflow-y-auto border-r border-white/6 bg-[#0a0d12]/95 px-5 py-6 xl:flex xl:flex-col">
      <BrandMark />

      <div className="mt-10 rounded-[28px] border border-white/8 bg-white/[0.03] p-3">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  isActive
                    ? "bg-cyan-300/14 text-white shadow-[0_14px_40px_rgba(34,211,238,0.12)]"
                    : "text-white/60 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? "bg-cyan-300/14 text-cyan-100" : "bg-white/[0.04]"}`}>
                  <Icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-white/40">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
