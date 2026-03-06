import logoUrl from "@/assets/pingu-logo.png";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-[#0d1b24] p-1 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
        <img
          src={logoUrl}
          alt="Логотип Pingu Music"
          className="h-full w-full rounded-xl bg-black object-contain p-1"
        />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">Desktop player</div>
        <div className="text-xl font-semibold text-white">Pingu Music</div>
      </div>
    </div>
  );
}
