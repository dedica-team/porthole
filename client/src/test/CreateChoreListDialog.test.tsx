import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateChoreListDialog from '../components/ChoreListsView/CreateChoreListDialog';
import * as mapApi from '../api/mapApi';
import { useMapStore } from '../store/mapStore';
import type { ChoreList } from '../types/chores';
import type { Landmark } from '../types/landmark';

vi.mock('../api/mapApi');

const LM1: Landmark = { id: 'lm1', name: 'Reception', ownerId: null, type: 'KEEP' };
const LM2: Landmark = { id: 'lm2', name: 'Server Room', ownerId: null, type: 'KEEP' };
const MAP_ID = 'map-1';

function setup(landmarks: Landmark[] = [LM1, LM2]) {
  useMapStore.setState({
    currentMap: {
      id: MAP_ID,
      createdAt: '',
      collaborators: [],
      landmarks: Object.fromEntries(landmarks.map((l) => [l.id, l])),
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
  });
}

function renderDialog(overrides: Partial<{ onCreated: (lists: ChoreList[]) => void; onOpenChange: (open: boolean) => void }> = {}) {
  const onCreated = overrides.onCreated ?? vi.fn();
  const onOpenChange = overrides.onOpenChange ?? vi.fn();
  render(<CreateChoreListDialog open={true} onOpenChange={onOpenChange} onCreated={onCreated} />);
  return { onCreated, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('CreateChoreListDialog – rendering', () => {
  it('renders empty title, link and description fields', () => {
    renderDialog();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/link/i) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toBe('');
  });

  it('lists all available landmarks, unchecked by default', () => {
    renderDialog();
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
    expect(screen.getByText('Reception')).toBeInTheDocument();
    expect(screen.getByText('Server Room')).toBeInTheDocument();
  });

  it('shows a placeholder message when the map has no landmarks', () => {
    setup([]);
    renderDialog();
    expect(screen.getByText('No landmarks on this map yet.')).toBeInTheDocument();
  });

  it('disables Create when the title is blank', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
  });

  it('enables Create once a title is typed', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Monthly Audit' } });
    expect(screen.getByRole('button', { name: /^create$/i })).not.toBeDisabled();
  });
});

// ── Landmark selection ────────────────────────────────────────────────────────

describe('CreateChoreListDialog – landmark selection', () => {
  it('selects all landmarks when "Select all" is clicked', () => {
    renderDialog();
    fireEvent.click(screen.getByText('Select all'));
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clears all landmarks when "Clear" is clicked after selecting all', () => {
    renderDialog();
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByText('Clear'));
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes.every((cb) => !cb.checked)).toBe(true);
  });

  it('toggles an individual landmark checkbox', () => {
    renderDialog();
    const checkbox = screen.getAllByRole('checkbox')[0] as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});

// ── Create ────────────────────────────────────────────────────────────────────

describe('CreateChoreListDialog – create', () => {
  it('calls createChoreList with the trimmed title and selected landmark ids', async () => {
    const created: ChoreList[] = [{ id: 'new-list', title: 'Monthly Audit', completed: false, entries: {} }];
    vi.mocked(mapApi.createChoreList).mockResolvedValue(created);
    const { onCreated, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Monthly Audit  ' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(mapApi.createChoreList).toHaveBeenCalledWith(
      MAP_ID, 'Monthly Audit', ['lm1'], undefined, undefined,
    ));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('passes trimmed link and description when provided', async () => {
    vi.mocked(mapApi.createChoreList).mockResolvedValue([]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Audit' } });
    fireEvent.change(screen.getByLabelText(/link/i), { target: { value: '  https://wiki.example  ' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: '  Check everything  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(mapApi.createChoreList).toHaveBeenCalledWith(
      MAP_ID, 'Audit', [], 'https://wiki.example', 'Check everything',
    ));
  });

  it('resets the form fields after a successful create', async () => {
    vi.mocked(mapApi.createChoreList).mockResolvedValue([]);
    renderDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Audit' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(mapApi.createChoreList).toHaveBeenCalled());
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('shows an error message when creation fails and keeps the dialog open', async () => {
    vi.mocked(mapApi.createChoreList).mockRejectedValue(new Error('Title already used'));
    const { onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Audit' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(screen.getByText('Title already used')).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('Cancel button closes the dialog without creating', () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mapApi.createChoreList).not.toHaveBeenCalled();
  });
});

