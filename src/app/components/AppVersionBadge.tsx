import { APP_VERSION_LABEL } from "../config/appVersion";

export function AppVersionBadge() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-5 z-40 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium tracking-[0.22em] text-white/45 backdrop-blur-md">
      {APP_VERSION_LABEL}
    </div>
  );
}
