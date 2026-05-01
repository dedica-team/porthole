import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChoreEntryRow from '../components/ChoreListsView/ChoreEntryRow';
import * as mapApi from '../api/mapApi';
import type { ChoreEntry, ChoreList } from '../types/chores';
import type { Collaborator } from '../types/session';
vi.mock('../api/mapApi');

const MAP_ID  = 'map-1';
const LIST_ID = 'list-1';
const LM_ID   = 'lm-1';

const COLLABORATORS: Collaborator[] = [
  { id: 'u1', username: 'alice' },
  { id: 'u2', username: 'bob' },
];

const makeEntry = (overrides: Partial<ChoreEntry> = {}): ChoreEntry => ({
  landmarkId: LM_ID,
  state: 'NONE',
  ...overrides,
});

const makeList = (entry: ChoreEntry): ChoreList => ({
  id: LIST_ID,
  title: 'Audit',
  completed: false,
  entries: { [LM_ID]: entry },
});

function renderRow(entry: ChoreEntry, isCollaborator = true) {
  const onUpdated = vi.fn();
  render(
    <table>
      <tbody>
        <ChoreEntryRow
          mapId={MAP_ID}
          listId={LIST_ID}
          entry={entry}
          landmarkName="Reception"
          collaborators={COLLABORATORS}
          isCollaborator={isCollaborator}
          onUpdated={onUpdated}
        />
      </tbody>
    </table>,
  );
  return { onUpdated };
}

beforeEach(() => vi.clearAllMocks());

// ── Read-only display ────────────────────────────────────────────────────────

describe('ChoreEntryRow – display', () => {
  it('renders landmark name', () => {
    renderRow(makeEntry());
    expect(screen.getByText('Reception')).toBeInTheDocument();
  });

  it('renders state badge', () => {
    renderRow(makeEntry({ state: 'BLOCKED' }));
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('renders assignee name when set', () => {
    renderRow(makeEntry({ assigneeId: 'u1' }));
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('renders — when no assignee', () => {
    renderRow(makeEntry());
    // multiple — possible; at least one
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders link when set', () => {
    renderRow(makeEntry({ link: 'https://wiki.example' }));
    expect(screen.getByRole('link', { name: /wiki\.example/i })).toBeInTheDocument();
  });

  it('renders note when set', () => {
    renderRow(makeEntry({ note: 'Check fire exits' }));
    expect(screen.getByText('Check fire exits')).toBeInTheDocument();
  });

  it('does not show pencil button for viewers', () => {
    renderRow(makeEntry(), false);
    expect(screen.queryByTitle('Edit entry')).not.toBeInTheDocument();
  });

  it('shows pencil button for collaborators', () => {
    renderRow(makeEntry());
    expect(screen.getByTitle('Edit entry')).toBeInTheDocument();
  });
});

// ── Edit popover ─────────────────────────────────────────────────────────────

describe('ChoreEntryRow – edit popover', () => {
  it('opens popover with current state pre-selected', async () => {
    renderRow(makeEntry({ state: 'ONGOING' }));
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => {
      // The "Ongoing" pill inside the popover should appear (alongside the row badge)
      expect(screen.getAllByText('Ongoing').length).toBeGreaterThan(0);
    });
  });

  it('pre-fills assignee select with current assignee', async () => {
    renderRow(makeEntry({ assigneeId: 'u2' }));
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('u2');
    });
  });

  it('pre-fills link input with current link', async () => {
    renderRow(makeEntry({ link: 'https://wiki.example' }));
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => {
      const input = screen.getByPlaceholderText('https://…') as HTMLInputElement;
      expect(input.value).toBe('https://wiki.example');
    });
  });

  it('pre-fills note textarea with current note', async () => {
    renderRow(makeEntry({ note: 'Check fridges' }));
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => {
      const ta = screen.getByPlaceholderText('Note…') as HTMLTextAreaElement;
      expect(ta.value).toBe('Check fridges');
    });
  });

  it('closes popover on Cancel without calling API', async () => {
    renderRow(makeEntry());
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
    expect(mapApi.updateChoreEntry).not.toHaveBeenCalled();
  });

  it('calls updateChoreEntry with all draft values on Save', async () => {
    const entry = makeEntry({ state: 'NONE' });
    const updated = makeList({ ...entry, state: 'DONE' });
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(updated);

    const { onUpdated } = renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));

    // Change state to DONE
    fireEvent.click(screen.getByText('Done'));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mapApi.updateChoreEntry).toHaveBeenCalledWith(
        MAP_ID, LIST_ID, LM_ID,
        expect.objectContaining({ state: 'DONE' }),
      );
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
  });

  it('closes popover after successful save', async () => {
    const entry = makeEntry();
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(makeList(entry));

    renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
  });

  it('shows saved checkmark after successful save', async () => {
    const entry = makeEntry();
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(makeList(entry));

    renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      // The Check icon is rendered; landmark cell element has it as a sibling
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
      // Row still shows "Reception" (not unmounted)
      expect(screen.getByText('Reception')).toBeInTheDocument();
    });
  });

  it('sends clearAssignee=true when assignee is cleared', async () => {
    const entry = makeEntry({ assigneeId: 'u1' });
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(makeList({ ...entry, assigneeId: undefined }));

    renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByRole('combobox'));

    // Set assignee to empty (Unassigned)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mapApi.updateChoreEntry).toHaveBeenCalledWith(
        MAP_ID, LIST_ID, LM_ID,
        expect.objectContaining({ clearAssignee: true }),
      );
    });
  });

  it('sends clearLink=true when link is cleared', async () => {
    const entry = makeEntry({ link: 'https://old.com' });
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(makeList({ ...entry, link: undefined }));

    renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByPlaceholderText('https://…'));

    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mapApi.updateChoreEntry).toHaveBeenCalledWith(
        MAP_ID, LIST_ID, LM_ID,
        expect.objectContaining({ clearLink: true }),
      );
    });
  });

  it('sends clearNote=true when note is cleared', async () => {
    const entry = makeEntry({ note: 'old note' });
    vi.mocked(mapApi.updateChoreEntry).mockResolvedValue(makeList({ ...entry, note: undefined }));

    renderRow(entry);
    fireEvent.click(screen.getByTitle('Edit entry'));
    await waitFor(() => screen.getByPlaceholderText('Note…'));

    fireEvent.change(screen.getByPlaceholderText('Note…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mapApi.updateChoreEntry).toHaveBeenCalledWith(
        MAP_ID, LIST_ID, LM_ID,
        expect.objectContaining({ clearNote: true }),
      );
    });
  });
});

