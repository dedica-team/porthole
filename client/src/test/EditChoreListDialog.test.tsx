import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditChoreListDialog from '../components/ChoreListsView/EditChoreListDialog';
import * as mapApi from '../api/mapApi';
import { useMapStore } from '../store/mapStore';
import type { ChoreList } from '../types/chores';
import type { Landmark } from '../types/landmark';

vi.mock('../api/mapApi');

const LM1: Landmark = { id: 'lm1', name: 'Reception', ownerId: null, type: 'KEEP' };
const LM2: Landmark = { id: 'lm2', name: 'Server Room', ownerId: null, type: 'KEEP' };
const MAP_ID = 'map-1';

function makeList(overrides: Partial<ChoreList> = {}): ChoreList {
  return {
    id: 'list-1',
    title: 'Audit',
    completed: false,
    entries: { [LM1.id]: { landmarkId: LM1.id, state: 'NONE' } },
    ...overrides,
  };
}

function setup() {
  useMapStore.setState({
    currentMap: {
      id: MAP_ID,
      createdAt: '',
      collaborators: [],
      landmarks: { [LM1.id]: LM1, [LM2.id]: LM2 },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
  });
}

function renderDialog(choreList: ChoreList | null, overrides: Partial<{
  onSaved: (lists: ChoreList[]) => void;
  onToggleCompleted: (updated: ChoreList) => void;
  onDeleted: (listId: string) => void;
  onOpenChange: (open: boolean) => void;
}> = {}) {
  const onSaved = overrides.onSaved ?? vi.fn();
  const onToggleCompleted = overrides.onToggleCompleted ?? vi.fn();
  const onDeleted = overrides.onDeleted ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(
    <EditChoreListDialog
      open={!!choreList}
      onOpenChange={onOpenChange}
      choreList={choreList}
      onSaved={onSaved}
      onToggleCompleted={onToggleCompleted}
      onDeleted={onDeleted}
    />,
  );
  return { onSaved, onToggleCompleted, onDeleted, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ── Rendering / pre-fill ──────────────────────────────────────────────────────

describe('EditChoreListDialog – pre-fill', () => {
  it('does not render form content when choreList is null', () => {
    renderDialog(null);
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('pre-fills title, link and description', () => {
    renderDialog(makeList({ title: 'Audit', link: 'https://wiki.example', description: 'Check everything' }));
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Audit');
    expect((screen.getByLabelText(/link/i) as HTMLInputElement).value).toBe('https://wiki.example');
    expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe('Check everything');
  });

  it('pre-selects landmarks that are already part of the list', () => {
    renderDialog(makeList());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const reception = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Reception')!;
    const serverRoom = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Server Room')!;
    expect(reception.checked).toBe(true);
    expect(serverRoom.checked).toBe(false);
  });

  it('shows "Mark list complete" when the list is not completed', () => {
    renderDialog(makeList({ completed: false }));
    expect(screen.getByRole('button', { name: /mark list complete/i })).toBeInTheDocument();
  });

  it('shows "Reopen list" when the list is completed', () => {
    renderDialog(makeList({ completed: true }));
    expect(screen.getByRole('button', { name: /reopen list/i })).toBeInTheDocument();
  });
});

// ── Landmark selection ────────────────────────────────────────────────────────

describe('EditChoreListDialog – landmark selection', () => {
  it('selects all landmarks when "Select all" is clicked', () => {
    renderDialog(makeList());
    fireEvent.click(screen.getByText('Select all'));
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
  });

  it('clears all landmarks when all are selected and "Clear" is clicked', () => {
    renderDialog(makeList());
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByText('Clear'));
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
  });

  it('toggles an individual landmark checkbox', () => {
    renderDialog(makeList());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const serverRoom = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Server Room')!;
    expect(serverRoom.checked).toBe(false);
    fireEvent.click(serverRoom);
    expect(serverRoom.checked).toBe(true);
  });
});

// ── Save ──────────────────────────────────────────────────────────────────────

describe('EditChoreListDialog – save', () => {
  it('calls editChoreList with the updated title and selected landmark ids', async () => {
    const list = makeList({ title: 'Audit' });
    vi.mocked(mapApi.editChoreList).mockResolvedValue([{ ...list, title: 'Renamed' }]);
    const { onSaved, onOpenChange } = renderDialog(list);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mapApi.editChoreList).toHaveBeenCalledWith(
      MAP_ID, 'list-1', 'Renamed', ['lm1'], undefined, undefined,
    ));
    expect(onSaved).toHaveBeenCalledWith([{ ...list, title: 'Renamed' }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('includes newly checked landmarks in the save payload', async () => {
    const list = makeList();
    vi.mocked(mapApi.editChoreList).mockResolvedValue([list]);
    renderDialog(list);

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    const serverRoom = checkboxes.find((cb) => cb.closest('label')?.textContent === 'Server Room')!;
    fireEvent.click(serverRoom);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const call = vi.mocked(mapApi.editChoreList).mock.calls[0];
      expect(new Set(call[3])).toEqual(new Set(['lm1', 'lm2']));
    });
  });

  it('disables Save when title is blank', () => {
    renderDialog(makeList({ title: 'Audit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows an error message when editChoreList rejects', async () => {
    vi.mocked(mapApi.editChoreList).mockRejectedValue(new Error('Server exploded'));
    renderDialog(makeList());
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Server exploded')).toBeInTheDocument());
  });

  it('Cancel button closes the dialog without saving', () => {
    const { onOpenChange } = renderDialog(makeList());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mapApi.editChoreList).not.toHaveBeenCalled();
  });
});

// ── Complete / Reopen toggle ──────────────────────────────────────────────────

describe('EditChoreListDialog – complete toggle', () => {
  it('calls toggleChoreListCompleted and notifies the parent', async () => {
    const list = makeList({ completed: false });
    vi.mocked(mapApi.toggleChoreListCompleted).mockResolvedValue({ ...list, completed: true });
    const { onToggleCompleted } = renderDialog(list);

    fireEvent.click(screen.getByRole('button', { name: /mark list complete/i }));

    await waitFor(() => expect(mapApi.toggleChoreListCompleted).toHaveBeenCalledWith(MAP_ID, 'list-1'));
    expect(onToggleCompleted).toHaveBeenCalledWith({ ...list, completed: true });
  });

  it('flips the button label to "Reopen list" after toggling', async () => {
    const list = makeList({ completed: false });
    vi.mocked(mapApi.toggleChoreListCompleted).mockResolvedValue({ ...list, completed: true });
    renderDialog(list);

    fireEvent.click(screen.getByRole('button', { name: /mark list complete/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /reopen list/i })).toBeInTheDocument());
  });

  it('shows an error message when toggling fails', async () => {
    vi.mocked(mapApi.toggleChoreListCompleted).mockRejectedValue(new Error('Toggle failed'));
    renderDialog(makeList());

    fireEvent.click(screen.getByRole('button', { name: /mark list complete/i }));

    await waitFor(() => expect(screen.getByText('Toggle failed')).toBeInTheDocument());
  });
});

// ── Delete ────────────────────────────────────────────────────────────────────

describe('EditChoreListDialog – delete', () => {
  it('shows a confirmation prompt before deleting', () => {
    renderDialog(makeList({ title: 'Audit' }));
    fireEvent.click(screen.getByRole('button', { name: /delete list…/i }));
    expect(screen.getByText(/delete «audit»/i)).toBeInTheDocument();
    expect(mapApi.deleteChoreList).not.toHaveBeenCalled();
  });

  it('cancelling the confirmation returns to the normal delete button', () => {
    renderDialog(makeList({ title: 'Audit' }));
    fireEvent.click(screen.getByRole('button', { name: /delete list…/i }));
    // Two "Cancel" buttons exist now: the inline confirm-cancel and the footer Cancel.
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0]);
    expect(screen.getByRole('button', { name: /delete list…/i })).toBeInTheDocument();
  });

  it('calls deleteChoreList and onDeleted after confirming', async () => {
    vi.mocked(mapApi.deleteChoreList).mockResolvedValue(undefined);
    const { onDeleted } = renderDialog(makeList({ id: 'list-1' }));

    fireEvent.click(screen.getByRole('button', { name: /delete list…/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(mapApi.deleteChoreList).toHaveBeenCalledWith(MAP_ID, 'list-1'));
    expect(onDeleted).toHaveBeenCalledWith('list-1');
  });

  it('shows an error message when deletion fails', async () => {
    vi.mocked(mapApi.deleteChoreList).mockRejectedValue(new Error('Delete failed'));
    renderDialog(makeList());

    fireEvent.click(screen.getByRole('button', { name: /delete list…/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(screen.getByText('Delete failed')).toBeInTheDocument());
  });
});


