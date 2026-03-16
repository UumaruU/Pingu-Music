import { Heart, History, House, ListMusic, LogIn, LogOut, Radio, UserPlus } from "lucide-react";
import { AuthUser, RouteId } from "../types";
import { getUserDisplayName } from "../services/userService";
import { BrandMark } from "./BrandMark";

type PrimaryRoute = "home" | "stream" | "history" | "favorites" | "playlists";

interface SidebarProps {
  activePage: RouteId;
  onNavigate: (route: RouteId) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  hasRestoredSession: boolean;
  onLogout: () => void;
}

export function Sidebar({
  activePage,
  onNavigate,
  user,
  isAuthenticated,
  isAuthLoading,
  hasRestoredSession,
  onLogout,
}: SidebarProps) {
  const navItems: Array<{
    id: PrimaryRoute;
    label: string;
    icon: typeof House;
    hint: string;
  }> = [
    { id: "home", label: "Главная", icon: House, hint: "Популярное и подборки" },
    { id: "stream", label: "Поток", icon: Radio, hint: "Бесконечные рекомендации" },
    { id: "history", label: "История", icon: History, hint: "Прослушанные треки" },
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
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                    isActive ? "bg-cyan-300/14 text-cyan-100" : "bg-white/[0.04]"
                  }`}
                >
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

      <div className="mt-auto rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 text-xs uppercase tracking-[0.22em] text-white/45">Профиль</div>
        {!hasRestoredSession ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/45">
            Восстанавливаем сессию...
          </div>
        ) : isAuthenticated && user ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="text-sm font-medium text-white">{getUserDisplayName(user)}</div>
              <div className="mt-1 text-xs text-white/50">@{user.login}</div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              disabled={isAuthLoading}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut size={15} />
              Выйти
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => onNavigate("login")}
              disabled={isAuthLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300/14 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={15} />
              Вход
            </button>
            <button
              type="button"
              onClick={() => onNavigate("register")}
              disabled={isAuthLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={15} />
              Регистрация
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
