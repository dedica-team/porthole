import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CreateConnectionDialog from '../components/CreateConnectionDialog';
import * as mapApi from '../api/mapApi';
import type { Landmark } from '../types/landmark';
import type { Connection } from '../types/connection';
import type { SessionState } from '../types/session';
vi.mock('../api/mapApi');

const LANDMARKS: Landmark[] = [
  { id: 'lm-1', name: 'Alpha', ownerId: 'u1', coordinate: { q: 0, r: 0 }, type: 'KEEP' },
  { id: 'lm-2', name: 'Beta',  ownerId: 'u1', coordinate: { q: 1, r: 0 }, type: 'KEEP' },
  { id: 'lm-3', name: 'Gamma', ownerId: 'u1', coordinate: { q: 2, r: 0 }, type: 'KEEP' },
];

const EMPTY_CONNECTIONS: Connection[] = [];

const STUB_MAP: SessionState = {
  id: 'map-1', createdAt: '', collaborators: [], landmarks: {}, connections: {},
  groups: {}, map: { tiles: [] },
};

function renderDialog(
  existingConnections = EMPTY_CONNECTIONS,
  onCreated = vi.fn(),
  onClose = vi.fn(),
) {
  return render(
    <CreateConnectionDialog
      open={true}
      onClose={onClose}
      mapId="map-1"
      landmarks={LANDMARKS}
      existingConnections={existingConnections}
      onCreated={onCreated}
    />,
  );
}

/** Return the n-th landmark picker trigger button (0=start, 1=end). */
function getLandmarkTrigger(index: 0 | 1) {
  const triggers = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('button[role="combobox"]'),
  );
  return triggers[index];
}

describe('CreateConnectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mapApi.createConnection).mockResolvedValue(STUB_MAP);
  });

  it('renders title input, type select and two landmark pickers', () => {
    renderDialog();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByText(/^start element$/i)).toBeInTheDocument();
    expect(screen.getByText(/^end element$/i)).toBeInTheDocument();
    // native <select> for type
    expect(document.body.querySelector('select')).toBeInTheDocument();
  });

  it('landmark search filters the list', async () => {
    renderDialog();
    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'gam' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows error and does not call API when no end landmark is selected', async () => {
    renderDialog();
    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));
    fireEvent.click(screen.getByText('Create Connection'));
    expect(await screen.findByText(/please select both elements/i)).toBeInTheDocument();
    expect(mapApi.createConnection).not.toHaveBeenCalled();
  });

  it('shows error for duplicate connection (bidirectional)', async () => {
    const existing: Connection[] = [{
      id: 'c1', originId: 'lm-1', targetId: 'lm-2', path: [], type: 'PIPE',
    }];
    renderDialog(existing);

    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    fireEvent.click(await screen.findByText('Beta'));

    fireEvent.click(screen.getByText('Create Connection'));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(mapApi.createConnection).not.toHaveBeenCalled();
  });

  it('calls createConnection and onCreated on successful submit', async () => {
    const onCreated = vi.fn();
    renderDialog(EMPTY_CONNECTIONS, onCreated);

    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    fireEvent.click(await screen.findByText('Beta'));

    fireEvent.click(screen.getByText('Create Connection'));

    await waitFor(() =>
      expect(mapApi.createConnection).toHaveBeenCalledWith('map-1', 'lm-1', 'lm-2', 'PIPE', undefined),
    );
    expect(onCreated).toHaveBeenCalledWith(STUB_MAP);
  });

  it('passes title to createConnection when provided', async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Main pipe' } });

    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    fireEvent.click(await screen.findByText('Gamma'));

    fireEvent.click(screen.getByText('Create Connection'));

    await waitFor(() =>
      expect(mapApi.createConnection).toHaveBeenCalledWith('map-1', 'lm-1', 'lm-3', 'PIPE', 'Main pipe'),
    );
  });

  it('selected start landmark is excluded from end picker', async () => {
    renderDialog();
    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    // Beta should appear in end picker
    const betaInEnd = await screen.findByText('Beta');
    // Alpha should NOT appear inside the open popover list (only as the start trigger label)
    const popoverContent = betaInEnd.closest('[role="dialog"], [data-radix-popper-content-wrapper]') ??
      betaInEnd.closest('div[style]') ??
      betaInEnd.parentElement!.parentElement!;
    const alphaInList = Array.from(popoverContent.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Alpha',
    );
    expect(alphaInList).toBeUndefined();
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog(EMPTY_CONNECTIONS, vi.fn(), onClose);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders stage dropdown when stages prop is provided and passes selected stage to onCreated', async () => {
    const onCreated = vi.fn();
    const stages = [
      { id: 's1', name: 'Preparation', order: 0 },
      { id: 's2', name: 'Execution', order: 1 },
    ];

    render(
      <CreateConnectionDialog
        open={true}
        onClose={vi.fn()}
        mapId="map-1"
        landmarks={LANDMARKS}
        existingConnections={EMPTY_CONNECTIONS}
        onCreated={onCreated}
        stages={stages}
        defaultStageId="s2"
      />,
    );

    const stageSelect = screen.getByLabelText('Stage') as HTMLSelectElement;
    expect(stageSelect).toBeInTheDocument();
    expect(stageSelect.value).toBe('s2');

    // Change stage selection to 'Preparation'
    fireEvent.change(stageSelect, { target: { value: 's1' } });
    expect(stageSelect.value).toBe('s1');

    // Select start and end landmarks
    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    fireEvent.click(await screen.findByText('Beta'));

    fireEvent.click(screen.getByText('Create Connection'));

    await waitFor(() =>
      expect(mapApi.createConnection).toHaveBeenCalledWith('map-1', 'lm-1', 'lm-2', 'PIPE', undefined),
    );
    expect(onCreated).toHaveBeenCalledWith(STUB_MAP, 's1');
  });

  it('allows choosing new stage or none from stage dropdown', async () => {
    const onCreated = vi.fn();
    const stages = [
      { id: 's1', name: 'Stage 1', order: 0 },
    ];

    render(
      <CreateConnectionDialog
        open={true}
        onClose={vi.fn()}
        mapId="map-1"
        landmarks={LANDMARKS}
        existingConnections={EMPTY_CONNECTIONS}
        onCreated={onCreated}
        stages={stages}
      />,
    );

    const stageSelect = screen.getByLabelText('Stage') as HTMLSelectElement;
    expect(screen.getByText('+ New stage')).toBeInTheDocument();
    expect(screen.getByText('None (do not add to stage)')).toBeInTheDocument();

    // Select + New stage
    fireEvent.change(stageSelect, { target: { value: '__NEW_STAGE__' } });

    act(() => { fireEvent.click(getLandmarkTrigger(0)); });
    fireEvent.click(await screen.findByText('Alpha'));

    act(() => { fireEvent.click(getLandmarkTrigger(1)); });
    fireEvent.click(await screen.findByText('Beta'));

    fireEvent.click(screen.getByText('Create Connection'));

    await waitFor(() =>
      expect(mapApi.createConnection).toHaveBeenCalledWith('map-1', 'lm-1', 'lm-2', 'PIPE', undefined),
    );
    expect(onCreated).toHaveBeenCalledWith(STUB_MAP, '__NEW_STAGE__');
  });
});

