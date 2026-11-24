import { Activity, Heart, History, House, Search, Settings, User } from "lucide-react";
import { AuthUser, RouteId } from "../types";
import { getUserDisplayName } from "../services/userService";
import { BrandMark } from "./BrandMark";
import { SidebarIconKey, getSidebarNavItems } from "./sidebarItems";

interface SidebarProps {
  activePage: RouteId;
  onNavigate: (route: RouteId) => void;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  hasRestoredSession: boolean;
  onLogout: () => void;
}

const iconByKey: Record<SidebarIconKey, typeof House> = {
  home: House,
  favorites: Heart,
  search: Search,
  history: History,
  profile: User,
  settings: Settings,
  activity: Activity,
};

export function Sidebar({
  activePage,
  onNavigate,
  user,
  isAuthenticated,
  isAuthLoading,
  hasRestoredSession,
  onLogout,
}: SidebarProps) {
  const navItems = getSidebarNavItems();

  return (
    <aside className="scrollbar-none flex h-full w-[190px] shrink-0 flex-col justify-between gap-[12px] overflow-y-auto">
      <div>
        <div className="mb-[12px] px-[14px] pb-[6px] pt-[10px]">
          <div className="mb-[12px] text-[14px] text-[#8f9097]">Inspires Music</div>
          <BrandMark />
        </div>

        <nav className="mb-[12px] flex flex-col gap-[8px] rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-[14px_12px]">
          {navItems.map((item) => {
            const Icon = iconByKey[item.iconKey];
            const isActive = item.route ? activePage === item.route : false;

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                title={item.disabled ? "Будет подключено в следующих этапах" : item.label}
                onClick={() => {
                  if (item.route) {
                    onNavigate(item.route);
                  }
                }}
                className={`inspires-focus-ring flex items-center gap-[12px] rounded-[18px] border border-transparent px-[14px] py-[14px] text-left text-[15px] transition ${
                  isActive
                    ? "bg-white/[0.05] text-white"
                    : item.disabled
                      ? "cursor-not-allowed text-[#747780] opacity-60"
                      : "text-[#d7d8dd] hover:bg-white/[0.04]"
                }`}
              >
                <Icon size={22} className="shrink-0 opacity-95" strokeWidth={1.8} />
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        disabled={isAuthLoading}
        onClick={() => {
          if (!isAuthenticated) {
            onNavigate("login");
          }
        }}
        className="inspires-focus-ring rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-[12px_14px] text-left transition hover:bg-white/[0.03] disabled:cursor-wait disabled:opacity-70"
      >
        {!hasRestoredSession ? (
          <div className="text-[13px] text-white/45">Восстанавливаем сессию...</div>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-[12px]">
            <div className="h-[44px] w-[44px] shrink-0 rounded-full border border-white/[0.08] bg-[radial-gradient(circle_at_35%_30%,#efd5a5,#7f5e43_45%,#30231d_85%)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold text-white">
                {getUserDisplayName(user)}
              </div>
              <div className="truncate text-[13px] text-[var(--im-muted)]">Открыть профиль</div>
            </div>
          </div>
        ) : (
          <div className="text-center text-[13px] text-white/60">Войти в аккаунт</div>
        )}
      </button>
    </aside>
  );
}
