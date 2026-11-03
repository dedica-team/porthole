import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChoreListsView from '../components/ChoreListsView/ChoreListsView';
import * as MapActionsContext from '../pages/MapPage/MapActionsContext';
import * as mapApi from '../api/mapApi';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { Landmark } from '../types/landmark';
import type { ChoreList } from '../types/chores';

vi.mock('../api/mapApi');

const LM1: Landmark = { id: 'lm1', name: 'Reception', type: 'KEEP', coordinate: { q: 0, r: 0 }, ownerId: null };
const LM2: Landmark = { id: 'lm2', name: 'Server Room', type: 'KEEP', coordinate: { q: 1, r: 0 }, ownerId: null };

const COLLAB1 = { id: 'u1', username: 'alice' };

const mockActions = {
  handleEditLandmark: vi.fn(),
  handleRemoveLandmark: vi.fn(),
  actionLoading: false,
  error: '',
  setError: vi.fn(),
};

function makeList(overrides: Partial<ChoreList> = {}): ChoreList {
  return {
    id: 'list1',
    title: 'Audit',
    completed: false,
    entries: { [LM1.id]: { landmarkId: LM1.id, state: 'NONE' } },
    ...overrides,
  };
}

function setup(lists: ChoreList[], isCollaboratorUser = true) {
  useAuthStore.setState({
    userId: isCollaboratorUser ? 'u1' : 'viewer',
    username: isCollaboratorUser ? 'alice' : 'viewer',
    token: 'tok',
    isAuthenticated: true,
  });
  useMapStore.setState({
    currentMap: {
      id: 'map1',
      createdAt: '',
      collaborators: [COLLAB1],
      landmarks: { [LM1.id]: LM1, [LM2.id]: LM2 },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
    choreLists: lists,
    choreListsFetched: true,
    choreListsLoading: false,
    choreListsError: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockActions).forEach((k) => {
    const v = (mockActions as Record<string, unknown>)[k];
    if (typeof v === 'function') (mockActions as Record<string, unknown>)[k] = vi.fn();
  });
  mockActions.actionLoading = false;
  mockActions.error = '';
  vi.spyOn(MapActionsContext, 'useMapActions').mockReturnValue(
    mockActions as unknown as ReturnType<typeof MapActionsContext.useMapActions>,
  );
});

// ── Table shape ──────────────────────────────────────────────────────────────

describe('ChoreListsView – table layout', () => {
  it('renders every landmark as a row', () => {
    setup([makeList()]);
    render(<ChoreListsView />);
    expect(screen.getAllByText('Reception').length).toBeGreaterThan(0);
    expect(screen.getByText('Server Room')).toBeInTheDocument();
  });

  it('renders every chore list as a column header', () => {
    setup([makeList({ id: 'list1', title: 'Audit' }), makeList({ id: 'list2', title: 'Cleanup', entries: {} })]);
    render(<ChoreListsView />);
    expect(screen.getByRole('columnheader', { name: /audit/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /cleanup/i })).toBeInTheDocument();
  });

  it('does not repeat the landmark name inside the entry cell (it is already the row header)', () => {
    setup([makeList()]);
    render(<ChoreListsView />);
    // "Reception" should appear exactly once — in the sticky row header — not again in the cell.
    expect(screen.getAllByText('Reception')).toHaveLength(1);
  });

  it('skips (renders a dash for) landmarks not included in a chore list', () => {
    setup([makeList({ entries: { [LM1.id]: { landmarkId: LM1.id, state: 'NONE' } } })]);
    render(<ChoreListsView />);
    const reception = screen.getAllByText('Reception')[0].closest('tr')!;
    const serverRoom = screen.getByText('Server Room').closest('tr')!;
    // Reception has a real, clickable entry cell
    expect(within(reception).getByTitle('Edit entry')).toBeInTheDocument();
    // Server Room isn't part of the list → skipped cell, no edit control
    expect(within(serverRoom).queryByTitle('Edit entry')).not.toBeInTheDocument();
    expect(within(serverRoom).getByText('—')).toBeInTheDocument();
  });

  it('shows the empty state when there are no chore lists', () => {
    setup([]);
    render(<ChoreListsView />);
    expect(screen.getByText('No chore lists yet.')).toBeInTheDocument();
  });
});

// ── Cell editing (delegated to ChoreEntryRow) ─────────────────────────────────

describe('ChoreListsView – cell editing', () => {
  it('opens the entry edit dialog when clicking a populated cell', async () => {
    setup([makeList()]);
    render(<ChoreListsView />);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());
  });

  it('does not open the entry edit dialog for non-collaborators', () => {
    setup([makeList()], false);
    render(<ChoreListsView />);
    fireEvent.click(screen.getByTitle('Edit entry'));
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

// ── Column header → edit dialog ───────────────────────────────────────────────

describe('ChoreListsView – column header edit dialog', () => {
  it('opens the edit dialog with the list title pre-filled when clicking the header', async () => {
    setup([makeList({ title: 'Audit' })]);
    render(<ChoreListsView />);
    fireEvent.click(screen.getByRole('button', { name: /audit/i }));
    await waitFor(() => {
      const input = screen.getByLabelText('Title') as HTMLInputElement;
      expect(input.value).toBe('Audit');
    });
  });

  it('lets visitors click a header to read the description without editing', () => {
    setup([makeList({ title: 'Audit', description: 'Weekly audit run' })], false);
    render(<ChoreListsView />);

    fireEvent.click(screen.getByRole('button', { name: /audit/i }));

    expect(screen.getByDisplayValue('Weekly audit run')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete list/i })).not.toBeInTheDocument();
  });

  it('saves the renamed list via editChoreList', async () => {
    const list = makeList({ title: 'Audit' });
    setup([list]);
    vi.mocked(mapApi.editChoreList).mockResolvedValue([{ ...list, title: 'Renamed' }]);

    render(<ChoreListsView />);
    fireEvent.click(screen.getByRole('button', { name: /audit/i }));
    const input = await screen.findByLabelText('Title');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mapApi.editChoreList).toHaveBeenCalledWith(
      'map1', 'list1', 'Renamed', ['lm1'], undefined, undefined,
    ));
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /renamed/i })).toBeInTheDocument());
  });

  it('toggles list completion via toggleChoreListCompleted', async () => {
    const list = makeList({ title: 'Audit', completed: false });
    setup([list]);
    vi.mocked(mapApi.toggleChoreListCompleted).mockResolvedValue({ ...list, completed: true });

    render(<ChoreListsView />);
    fireEvent.click(screen.getByRole('button', { name: /audit/i }));
    fireEvent.click(await screen.findByRole('button', { name: /mark list complete/i }));

    await waitFor(() => expect(mapApi.toggleChoreListCompleted).toHaveBeenCalledWith('map1', 'list1'));
  });

  it('deletes the list after confirmation via deleteChoreList', async () => {
    const list = makeList({ title: 'Audit' });
    setup([list]);
    vi.mocked(mapApi.deleteChoreList).mockResolvedValue(undefined);

    render(<ChoreListsView />);
    fireEvent.click(screen.getByRole('button', { name: /audit/i }));
    fireEvent.click(await screen.findByRole('button', { name: /delete list…/i }));
    fireEvent.click(await screen.findByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(mapApi.deleteChoreList).toHaveBeenCalledWith('map1', 'list1'));
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: /audit/i })).not.toBeInTheDocument());
  });
});

// ── Landmark editing via row header ───────────────────────────────────────────

describe('ChoreListsView – landmark row editing', () => {
  it('clicking a landmark name opens the LandmarkInfoPopover and allows removal', () => {
    setup([makeList()]);
    render(<ChoreListsView />);

    fireEvent.click(screen.getAllByText('Reception')[0]);
    fireEvent.click(screen.getByTitle('Edit Element'));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, remove/i }));

    expect(mockActions.handleRemoveLandmark).toHaveBeenCalledWith('lm1');
  });
});




