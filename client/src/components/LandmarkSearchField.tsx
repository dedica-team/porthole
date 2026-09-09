import { useState, useMemo, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { Landmark } from '@/types/landmark';
import { isDecorative } from '@/types/landmark';
import { useMapStore } from '@/store/mapStore';

interface Props {
  landmarks: Landmark[];
  onSelect: (landmark: Landmark) => void;
  placeholder?: string;
}

export default function LandmarkSearchField({ landmarks, onSelect, placeholder = 'Search…' }: Props) {
  const mapGroups = useMapStore((s) => s.currentMap?.groups);
  const groups = mapGroups ?? {};
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
      e.stopPropagation();
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
    <Popover open={showDropdown} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
          <Input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (query.trim() && filtered.length > 0) setOpen(true); }}
            type="search"
            placeholder={placeholder}
            className="h-9 pl-8 pr-3 w-48 rounded-lg shadow-lg border border-border bg-card/80 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-1 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-56 p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto">
          {filtered.map((l) => (
            <button
              key={l.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(l);
              }}
              className="w-full flex flex-col px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              <span className="text-sm font-medium truncate">{l.name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {l.groupId && groups[l.groupId] ? groups[l.groupId].name : l.type.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
