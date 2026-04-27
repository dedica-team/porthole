import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import React, { useRef } from 'react';
import {
  useGroupFilter,
  GroupFilterButton,
  GroupFilterPopover,
  type GroupSection,
} from '../components/ui/GroupFilterPopover';

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'test.hiddenGroups';

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── fixtures ──────────────────────────────────────────────────────────────────

const SECTIONS: GroupSection[] = [
  { groupId: 'g1', label: 'Alpha', color: '#e74c3c' },
  { groupId: 'g2', label: 'Beta',  color: '#3498db' },
  { groupId: null, label: 'Ungrouped', color: '#6b7280' },
];

// ── useGroupFilter ────────────────────────────────────────────────────────────

describe('useGroupFilter', () => {
  beforeEach(clearStorage);
  afterEach(clearStorage);

  it('starts with an empty hidden-groups set', () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    expect(result.current.hiddenGroups.size).toBe(0);
  });

  it('starts with filterOpen = false', () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    expect(result.current.filterOpen).toBe(false);
  });

  it('setHiddenGroups updates the set', async () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    await act(async () => {
      result.current.setHiddenGroups(new Set(['g1']));
    });
    expect(result.current.hiddenGroups.has('g1')).toBe(true);
  });

  it('setHiddenGroups persists to localStorage', async () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    await act(async () => {
      result.current.setHiddenGroups(new Set(['g1', 'g2']));
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toContain('g1');
    expect(stored).toContain('g2');
  });

  it('serialises null (Ungrouped) as "__null__" in localStorage', async () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    await act(async () => {
      result.current.setHiddenGroups(new Set([null]));
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toContain('__null__');
  });

  it('restores persisted hidden groups on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['g1', '__null__']));
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    expect(result.current.hiddenGroups.has('g1')).toBe(true);
    expect(result.current.hiddenGroups.has(null)).toBe(true);
    expect(result.current.hiddenGroups.has('g2')).toBe(false);
  });

  it('handles corrupted localStorage gracefully (empty set)', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    expect(result.current.hiddenGroups.size).toBe(0);
  });

  it('setFilterOpen toggles the popover open state', async () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    await act(async () => { result.current.setFilterOpen(true); });
    expect(result.current.filterOpen).toBe(true);
    await act(async () => { result.current.setFilterOpen(false); });
    expect(result.current.filterOpen).toBe(false);
  });

  it('supports functional updater for setHiddenGroups', async () => {
    const { result } = renderHook(() => useGroupFilter(STORAGE_KEY));
    await act(async () => {
      result.current.setHiddenGroups((prev) => {
        const next = new Set(prev);
        next.add('g1');
        return next;
      });
    });
    expect(result.current.hiddenGroups.has('g1')).toBe(true);
  });
});

// ── GroupFilterButton ─────────────────────────────────────────────────────────

describe('GroupFilterButton', () => {
  it('renders a button with title "Filter groups" when inactive', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<GroupFilterButton btnRef={ref} active={false} onClick={vi.fn()} />);
    expect(screen.getByTitle('Filter groups')).toBeInTheDocument();
  });

  it('shows an active title when active=true', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<GroupFilterButton btnRef={ref} active={true} onClick={vi.fn()} />);
    expect(screen.getByTitle(/groups filtered/i)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    const onClick = vi.fn();
    render(<GroupFilterButton btnRef={ref} active={false} onClick={onClick} />);
    fireEvent.click(screen.getByTitle('Filter groups'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary colour class when active', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<GroupFilterButton btnRef={ref} active={true} onClick={vi.fn()} />);
    const btn = screen.getByTitle(/groups filtered/i);
    expect(btn.className).toContain('text-primary');
  });

  it('applies muted class when inactive', () => {
    const ref = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<GroupFilterButton btnRef={ref} active={false} onClick={vi.fn()} />);
    const btn = screen.getByTitle('Filter groups');
    expect(btn.className).toContain('text-muted-foreground');
  });
});

// ── GroupFilterPopover ────────────────────────────────────────────────────────

/**
 * Mounts a real <button> so btnRef.current is populated, then
 * conditionally mounts GroupFilterPopover after the ref is set.
 * We call render() inside act() so the useLayoutEffect flush happens
 * before the first assertion.
 */
function PopoverHarness({
  open,
  sections,
  hiddenGroups,
  onToggle,
  onShowAll,
}: {
  open: boolean;
  sections: GroupSection[];
  hiddenGroups: Set<string | null>;
  onToggle: (id: string | null) => void;
  onShowAll: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState(false);
  React.useLayoutEffect(() => { setReady(true); }, []);
  return (
    <>
      <button ref={btnRef}>trigger</button>
      {ready && (
        <GroupFilterPopover
          open={open}
          btnRef={btnRef}
          popoverRef={popoverRef}
          sections={sections}
          hiddenGroups={hiddenGroups}
          onToggle={onToggle}
          onShowAll={onShowAll}
        />
      )}
    </>
  );
}

/** Render the harness and flush all effects synchronously. */
function renderPopover(props: React.ComponentProps<typeof PopoverHarness>) {
  let result!: ReturnType<typeof render>;
  act(() => { result = render(<PopoverHarness {...props} />); });
  return result;
}

describe('GroupFilterPopover', () => {
  // No manual cleanup needed — RTL's own cleanup unmounts portals correctly.

  it('renders nothing when open=false', () => {
    renderPopover({ open: false, sections: SECTIONS, hiddenGroups: new Set(), onToggle: vi.fn(), onShowAll: vi.fn() });
    expect(document.body.textContent).not.toContain('Alpha');
  });

  it('renders all section labels when open=true', () => {
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(), onToggle: vi.fn(), onShowAll: vi.fn() });
    expect(document.body).toHaveTextContent('Alpha');
    expect(document.body).toHaveTextContent('Beta');
    expect(document.body).toHaveTextContent('Ungrouped');
  });

  it('does NOT show "Show all" when nothing is hidden', () => {
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(), onToggle: vi.fn(), onShowAll: vi.fn() });
    expect(document.body).not.toHaveTextContent('Show all');
  });

  it('shows "Show all" when at least one group is hidden', () => {
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(['g1']), onToggle: vi.fn(), onShowAll: vi.fn() });
    expect(document.body).toHaveTextContent('Show all');
  });

  it('clicking "Show all" calls onShowAll', () => {
    const onShowAll = vi.fn();
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(['g1']), onToggle: vi.fn(), onShowAll });
    const btn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Show all'))!;
    fireEvent.click(btn);
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('clicking a group row calls onToggle with that groupId', () => {
    const onToggle = vi.fn();
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(), onToggle, onShowAll: vi.fn() });
    const btn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Alpha'))!;
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith('g1');
  });

  it('clicking the Ungrouped row calls onToggle with null', () => {
    const onToggle = vi.fn();
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(), onToggle, onShowAll: vi.fn() });
    const btn = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Ungrouped'))!;
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith(null);
  });

  it('hidden group label has line-through styling', () => {
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(['g1']), onToggle: vi.fn(), onShowAll: vi.fn() });
    const span = Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Alpha')!;
    expect(span.className).toContain('line-through');
  });

  it('visible group label does NOT have line-through styling', () => {
    renderPopover({ open: true, sections: SECTIONS, hiddenGroups: new Set(), onToggle: vi.fn(), onShowAll: vi.fn() });
    const span = Array.from(document.body.querySelectorAll('span')).find((s) => s.textContent === 'Alpha')!;
    expect(span.className).not.toContain('line-through');
  });

  it('visible group row renders a check icon (svg)', () => {
    const sections = [{ groupId: 'g1', label: 'Alpha', color: '#e74c3c' }];
    renderPopover({ open: true, sections, hiddenGroups: new Set(), onToggle: vi.fn(), onShowAll: vi.fn() });
    const row = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Alpha'))!;
    expect(row.querySelector('svg')).not.toBeNull();
  });

  it('hidden group row does NOT render a check icon', () => {
    const sections = [{ groupId: 'g1', label: 'Alpha', color: '#e74c3c' }];
    renderPopover({ open: true, sections, hiddenGroups: new Set(['g1']), onToggle: vi.fn(), onShowAll: vi.fn() });
    const row = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Alpha'))!;
    expect(row.querySelector('svg')).toBeNull();
  });
});

// ── integration: MetricsView group filter ─────────────────────────────────────
// (heavier integration tests live in MetricsView.test.tsx)

