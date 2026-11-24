import logoUrl from "@/assets/inspires-logo.png";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/[0.07] bg-black p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <img
          src={logoUrl}
          alt="Логотип Inspires Music"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.32em] text-white/[0.42]">Desktop player</div>
        <div className="truncate text-lg font-semibold text-white">Inspires Music</div>
      </div>
    </div>
  );
}
