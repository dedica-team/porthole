import React, { useEffect, useRef, useState } from 'react';
import { StatusIndicator } from '@/components/ui/status-badge';

import ReactDOM from 'react-dom';
import { Check, Filter } from 'lucide-react';

// ── Shared group-filter hook + popover ───────────────────────────────────────
// Persists hidden-group IDs to localStorage under a per-storageKey key.
// The null entry represents the "Ungrouped" pseudo-group.

export interface GroupSection {
  groupId: string | null;
  label: string;
  color: string;
}

// Serialize null as the literal string "__null__" for localStorage.
const NULL_KEY = '__null__';
function encode(id: string | null): string { return id ?? NULL_KEY; }
function decode(raw: string): string | null { return raw === NULL_KEY ? null : raw; }

export function useGroupFilter(storageKey: string) {
  const [hiddenGroups, setHiddenGroupsRaw] = useState<Set<string | null>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return new Set();
      const arr: string[] = JSON.parse(raw);
      return new Set(arr.map(decode));
    } catch {
      return new Set();
    }
  });

  const setHiddenGroups = (next: Set<string | null> | ((prev: Set<string | null>) => Set<string | null>)) => {
    setHiddenGroupsRaw((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try {
        localStorage.setItem(storageKey, JSON.stringify([...resolved].map(encode)));
      } catch { /* storage full or unavailable */ }
      return resolved;
    });
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node) &&
        filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node)
      ) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  return { hiddenGroups, setHiddenGroups, filterOpen, setFilterOpen, filterBtnRef, filterPopoverRef };
}

// ── Filter trigger button (rendered inside the top-left <th>) ────────────────

interface FilterBtnProps {
  btnRef: React.RefObject<HTMLButtonElement | null>;
  active: boolean;
  onClick: () => void;
}

export function GroupFilterButton({ btnRef, active, onClick }: FilterBtnProps) {
  return (
    <button
      ref={btnRef}
      className={`absolute top-1 left-0 w-4 flex items-center justify-center transition-colors ${
        active
          ? 'text-primary drop-shadow-[0_0_3px_hsl(var(--primary))]'
          : 'text-muted-foreground/40 hover:text-muted-foreground'
      }`}
      title={active ? 'Groups filtered — click to change' : 'Filter groups'}
      onClick={onClick}
    >
      <Filter className={`h-2.5 w-2.5${active ? ' fill-primary/20' : ''}`} />
    </button>
  );
}

// ── Popover portal ────────────────────────────────────────────────────────────

interface PopoverProps {
  open: boolean;
  btnRef: React.RefObject<HTMLButtonElement | null>;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  sections: GroupSection[];
  hiddenGroups: Set<string | null>;
  onToggle: (groupId: string | null) => void;
  onShowAll: () => void;
}

export function GroupFilterPopover({
  open, btnRef, popoverRef, sections, hiddenGroups, onToggle, onShowAll,
}: PopoverProps) {
  if (!open || !btnRef.current) return null;
  const btnRect = btnRef.current.getBoundingClientRect();

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-popover border border-border rounded-md shadow-lg py-1 min-w-44"
      style={{ top: btnRect.bottom + 4, left: btnRect.left }}
    >
      <div className="px-3 py-1 flex items-center justify-between">
        <span className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Show groups</span>
        {hiddenGroups.size > 0 && (
          <button className="text-sm text-primary hover:underline" onClick={onShowAll}>
            Show all
          </button>
        )}
      </div>
      {sections.map(({ groupId, label, color }) => {
        const visible = !hiddenGroups.has(groupId);
        return (
          <button
            key={groupId ?? 'ungrouped'}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2"
            onClick={() => onToggle(groupId)}
          >
            <StatusIndicator status="NONE" style={{ backgroundColor: color }} className="border border-white/20" />
            <span className={`flex-1 truncate${visible ? '' : ' line-through text-muted-foreground'}`}>{label}</span>
            {visible && <Check className="h-3 w-3 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

