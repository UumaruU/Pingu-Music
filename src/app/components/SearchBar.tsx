import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  recentQueries: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onSelectRecentQuery: (query: string) => void;
}

export function SearchBar({
  value,
  recentQueries,
  onChange,
  onSubmit,
  onClear,
  onSelectRecentQuery,
}: SearchBarProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !containerRef.current?.contains(target)) {
        setIsHistoryOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <form
        className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#101114]/88 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl"
        onSubmit={(event) => {
          event.preventDefault();
          setIsHistoryOpen(false);
          onSubmit();
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-white/38">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder="Поиск музыки, артистов и плейлистов"
          value={value}
          onFocus={() => setIsHistoryOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsHistoryOpen(true);
          }}
          className="w-full bg-transparent py-3.5 pl-11 pr-28 text-sm text-white outline-none placeholder:text-white/36"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsHistoryOpen(true);
              }}
              className="inspires-focus-ring rounded-full p-2 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
              title="Очистить"
            >
              <X size={15} />
            </button>
          ) : null}
          <button
            type="submit"
            className="inspires-focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/90"
          >
            Найти
          </button>
        </div>
      </form>

      {isHistoryOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-[22px] border border-white/[0.07] bg-[#0b0b0d]/98 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-white/38">История поиска</div>
          {recentQueries.length ? (
            <div className="flex flex-wrap gap-2">
              {recentQueries.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => {
                    setIsHistoryOpen(false);
                    onSelectRecentQuery(query);
                  }}
                  className="inspires-focus-ring rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.07] hover:text-white"
                >
                  {query}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/45">История пока пустая.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
