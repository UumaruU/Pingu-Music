import { Compass, Search, X } from "lucide-react";
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
    <div ref={containerRef} className="relative">
      <form
        className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.04] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        onSubmit={(event) => {
          event.preventDefault();
          setIsHistoryOpen(false);
          onSubmit();
        }}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center gap-2 pl-5 text-cyan-100/70">
          <Compass size={18} />
          <Search size={16} className="text-white/30" />
        </div>
        <input
          type="text"
          placeholder="Поиск музыки"
          value={value}
          onFocus={() => setIsHistoryOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setIsHistoryOpen(true);
          }}
          className="w-full bg-transparent py-4 pl-20 pr-32 text-white outline-none placeholder:text-white/35"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
          {value ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsHistoryOpen(true);
              }}
              className="rounded-full p-2 text-white/45 transition hover:bg-white/8 hover:text-white"
            >
              <X size={16} />
            </button>
          ) : null}
          <button type="submit" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-200">
            Найти
          </button>
        </div>
      </form>

      {isHistoryOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-30 rounded-2xl border border-white/10 bg-[#0f131a]/98 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">История поиска</div>
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
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-white"
                >
                  {query}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/45">История пока пуста.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
