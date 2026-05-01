import { useState, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Landmark } from '@/types/landmark';
import { isDecorative } from '@/types/landmark';
interface Props {
  landmarks: Landmark[];           // already filtered to positioned only
  onSelect: (landmark: Landmark) => void;
}

export default function LandmarkSearchField({ landmarks, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return landmarks.filter((l) => !isDecorative(l.type) && l.name.toLowerCase().includes(q));
  }, [landmarks, query]);

  const reset = () => {
    setQuery('');
    setOpen(false);
  };

  const select = (landmark: Landmark) => {
    onSelect(landmark);
    reset();
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filtered[0]) select(filtered[0]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // prevent global ESC handler from firing
      reset();
      inputRef.current?.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(val.trim().length > 0);
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
      <Input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim() && filtered.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search…"
        className="h-9 pl-8 pr-3 w-48 rounded-lg shadow-lg border border-border bg-card/80 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((l) => (
              <button
                key={l.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur from closing before click
                  select(l);
                }}
                className="w-full flex flex-col px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <span className="text-sm font-medium truncate">{l.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {l.type.replace(/_/g, ' ')} · ({l.coordinate!.q}, {l.coordinate!.r})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


