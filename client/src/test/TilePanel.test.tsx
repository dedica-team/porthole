/**
 * Tests for TilePanel – decorative landmark behaviour:
 *  - isDecorative() / DECORATIVE_LANDMARK_TYPES contract (map.ts)
 *  - string is shown as ID preview when a decorative type (WALL) is selected
 *  - string is a valid v4 string
 *  - string regenerates when WALL is (re-)selected
 *  - canSubmit does not require a name for decorative types
 *  - Slug-taken check is skipped for decorative types
 *  - Non-decorative types still require a name and show slug previews
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TilePanel from '../components/Sidebar/panels/TilePanel';
import { useMapStore, useAuthStore } from '../store/mapStore';
import { isDecorative, DECORATIVE_LANDMARK_TYPES, ALL_LANDMARK_TYPES } from '../types/landmark';
// ── string format ───────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── store fixtures ────────────────────────────────────────────────────────────

const BASE_MAP = {
  id: 'map-1',
  createdAt: '',
  collaborators: [{ id: 'p1', username: 'alice' }],
  landmarks: {
    // existing slug-based landmark to test slug-taken logic
    'iron-keep': {
      id: 'iron-keep', name: 'Iron Keep', ownerId: 'p1',
      coordinate: { q: 9, r: 9 }, type: 'KEEP' as const,
    },
  },
  connections: {},
  groups: {},
  map: {
    tiles: [
      { coordinate: { q: 1, r: 0 }, elevation: 2, terrain: 'GRASS' as const, ownerId: null },
      { coordinate: { q: 2, r: 0 }, elevation: 0, terrain: 'WATER' as const, ownerId: null },
    ],
  },
};

function setup(selectedTile = { q: 1, r: 0 }) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: BASE_MAP,
    selectedTile,
    mainView: 'tile',
    confirmPending: false,
  });
}

function openForm(onPlaceLandmark = vi.fn()) {
  render(<TilePanel onPlaceLandmark={onPlaceLandmark} onPositionLandmark={vi.fn()} loading={false} />);
  fireEvent.click(screen.getByRole('button', { name: /create landmark/i }));
}

function selectType(type: string) {
  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: type } });
}

// ── isDecorative / DECORATIVE_LANDMARK_TYPES contract ────────────────────────

describe('isDecorative() and DECORATIVE_LANDMARK_TYPES (map.ts)', () => {
  it('WALL is decorative', () => {
    expect(isDecorative('WALL')).toBe(true);
  });

  it('DECORATIVE_LANDMARK_TYPES contains WALL', () => {
    expect(DECORATIVE_LANDMARK_TYPES.has('WALL')).toBe(true);
  });

  it('all non-decorative types return false', () => {
    const nonDecorative = ALL_LANDMARK_TYPES.filter((t) => !DECORATIVE_LANDMARK_TYPES.has(t));
    expect(nonDecorative.length).toBeGreaterThan(0);
    nonDecorative.forEach((t) => expect(isDecorative(t)).toBe(false));
  });

  it('every type listed in DECORATIVE_LANDMARK_TYPES is a known LandmarkType', () => {
    for (const t of DECORATIVE_LANDMARK_TYPES) {
      expect(ALL_LANDMARK_TYPES).toContain(t);
    }
  });
});

// ── slug id preview (non-decorative) ─────────────────────────────────────────

describe('TilePanel – slug id preview for non-decorative types', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('shows slug id preview (not string) when non-decorative type is selected', () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText(/iron keep/i), { target: { value: 'Iron Gate' } });
    selectType('KEEP');
    const idLine = screen.getByText(/^id:/);
    expect(idLine.textContent).toContain('iron-gate');
    expect(idLine.textContent).not.toMatch(UUID_RE);
  });
});

// ── submit validation ─────────────────────────────────────────────────────────

describe('TilePanel – submit validation for decorative vs non-decorative types', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('Create Landmark button is enabled for decorative type (WALL) with any non-empty name', () => {
    openForm();
    selectType('WALL');
    fireEvent.change(screen.getByPlaceholderText(/name \(optional\)/i), { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: /create landmark/i })).not.toBeDisabled();
  });

  it('Create Landmark button is enabled for decorative type (WALL) even with empty name', () => {
    openForm();
    selectType('WALL');
    // leave name empty – decorative types do not require a name
    expect(screen.getByRole('button', { name: /create landmark/i })).not.toBeDisabled();
  });

  it('decorative type (WALL) name matching an existing slug is accepted (no slug check)', () => {
    openForm();
    selectType('WALL');
    // 'iron keep' would normally collide with slug 'iron-keep' for non-decorative types
    fireEvent.change(screen.getByPlaceholderText(/name \(optional\)/i), { target: { value: 'iron keep' } });
    expect(screen.getByRole('button', { name: /create landmark/i })).not.toBeDisabled();
    expect(screen.queryByText(/already taken/i)).not.toBeInTheDocument();
  });

  it('non-decorative type with duplicate slug shows taken warning and disables submit', () => {
    openForm();
    selectType('KEEP');
    fireEvent.change(screen.getByPlaceholderText(/iron keep/i), { target: { value: 'iron keep' } });
    expect(screen.getByText(/already taken/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create landmark/i })).toBeDisabled();
  });

  it('non-decorative type with empty name disables submit', () => {
    openForm();
    selectType('KEEP');
    // name field is empty by default
    expect(screen.getByRole('button', { name: /create landmark/i })).toBeDisabled();
  });

  it('calls onPlaceLandmark with decorative type (WALL) and provided name on submit', () => {
    const onPlace = vi.fn();
    render(<TilePanel onPlaceLandmark={onPlace} onPositionLandmark={vi.fn()} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /create landmark/i }));
    selectType('WALL');
    fireEvent.change(screen.getByPlaceholderText(/name \(optional\)/i), { target: { value: 'East Wall' } });
    fireEvent.submit(screen.getByRole('button', { name: /create landmark/i }).closest('form')!);
    expect(onPlace).toHaveBeenCalledWith(1, 0, 'East Wall', 'WALL');
  });

  it('calls onPlaceLandmark with string as name when no name is entered for decorative type (WALL)', () => {
    const onPlace = vi.fn();
    render(<TilePanel onPlaceLandmark={onPlace} onPositionLandmark={vi.fn()} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /create landmark/i }));
    selectType('WALL');
    // submit immediately without typing a name
    fireEvent.submit(screen.getByRole('button', { name: /create landmark/i }).closest('form')!);
    expect(onPlace).toHaveBeenCalledOnce();
    const [, , submittedName, submittedType] = onPlace.mock.calls[0];
    expect(submittedType).toBe('WALL');
    expect(submittedName).toMatch(UUID_RE);
  });
});

// ── string id input (decorative types) ─────────────────────────────────────────

describe('TilePanel – string id input for decorative types', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('shows an editable string id input when WALL (decorative) is selected', () => {
    openForm();
    selectType('WALL');
    const idInput = screen.getByPlaceholderText(/ID \(string\)/i) as HTMLInputElement;
    expect(idInput).toBeDefined();
    expect(idInput.value).toMatch(UUID_RE);
  });

  it('does not show the string id input for non-decorative types', () => {
    openForm();
    selectType('KEEP');
    expect(screen.queryByPlaceholderText(/ID \(string\)/i)).not.toBeInTheDocument();
  });

  it('name input shows "(optional)" placeholder for decorative type', () => {
    openForm();
    selectType('WALL');
    expect(screen.getByPlaceholderText(/name \(optional\)/i)).toBeInTheDocument();
  });

  it('name input does not show "(optional)" placeholder for non-decorative type', () => {
    openForm();
    selectType('KEEP');
    expect(screen.queryByPlaceholderText(/name \(optional\)/i)).not.toBeInTheDocument();
  });
});

// ── string regeneration ─────────────────────────────────────────────────────────

describe('TilePanel – string regenerates when decorative type is re-selected', () => {
  beforeEach(() => { vi.clearAllMocks(); setup(); });

  it('string changes when switching away from WALL and back', () => {
    openForm();
    selectType('WALL');
    const first = (screen.getByPlaceholderText(/ID \(string\)/i) as HTMLInputElement).value;

    selectType('KEEP');
    selectType('WALL');
    const second = (screen.getByPlaceholderText(/ID \(string\)/i) as HTMLInputElement).value;

    expect(first).toMatch(UUID_RE);
    expect(second).toMatch(UUID_RE);
    expect(first).not.toBe(second);
  });
});

// ── positioning list UX for unpositioned landmarks ─────────────────────────────

describe('TilePanel – positioning list UX for unpositioned landmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        ...BASE_MAP,
        groups: {
          g1: { id: 'g1', name: 'Alpha', color: '#e74c3c' },
        },
        landmarks: {
          ...BASE_MAP.landmarks,
          'fuel-depot': {
            id: 'fuel-depot',
            name: 'Fuel Depot',
            ownerId: 'p1',
            type: 'KEEP' as const,
            groupId: 'g1',
          },
          'signal-tower': {
            id: 'signal-tower',
            name: 'Signal Tower',
            ownerId: 'p1',
            type: 'WATCHTOWER' as const,
          },
        },
      },
      selectedTile: { q: 1, r: 0 },
      mainView: 'tile',
      confirmPending: false,
    });
  });

  it('shows unpositioned landmarks and their group label', () => {
    render(<TilePanel onPlaceLandmark={vi.fn()} onPositionLandmark={vi.fn()} loading={false} />);
    expect(screen.getByText(/position existing landmark/i)).toBeInTheDocument();
    expect(screen.getByText(/fuel depot/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('filters list by search query and shows empty message when no match', () => {
    render(<TilePanel onPlaceLandmark={vi.fn()} onPositionLandmark={vi.fn()} loading={false} />);
    const input = screen.getByPlaceholderText(/search landmarks/i);

    fireEvent.change(input, { target: { value: 'signal' } });
    expect(screen.getByText(/signal tower/i)).toBeInTheDocument();
    expect(screen.queryByText(/fuel depot/i)).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'does-not-exist' } });
    expect(screen.getByText(/no matching landmarks found/i)).toBeInTheDocument();
  });
});
