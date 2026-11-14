import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LandmarkPanel from '../components/Sidebar/panels/LandmarkPanel';
import { useMapStore, useAuthStore } from '../store/mapStore';
import type { Landmark } from '../types/landmark';
import type { CollaboratorMatrix } from '../types/matrix';
const landmark: Landmark = {
  id: 'tower-abc123',
  name: 'Iron Keep',
  ownerId: 'player-1',
  coordinate: { q: 0, r: 0 },
  type: 'KEEP',
};

const GROUP_ID = 'grp-1';

function setup(userId = 'player-1', extraLandmark: Partial<Landmark> = {}) {
  useAuthStore.setState({ userId, username: 'test', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    selectedLandmark: { ...landmark, ...extraLandmark },
    currentMap: {
      id: 'map-1',
      createdAt: '',
      collaborators: [
        { id: 'player-1', username: 'alice' },
        { id: 'other-user', username: 'bob' },
      ],
      landmarks: { 'tower-abc123': { ...landmark, ...extraLandmark } },
      connections: {},
      groups: {
        [GROUP_ID]: { id: GROUP_ID, name: 'Alpha Squad', color: '#e74c3c' },
      },
      map: { tiles: [] },
    },
    mainView: 'landmark',
  });
}

describe('LandmarkPanel (TowerInfoDialog replacement)', () => {
  const defaultProps = {
    onStartConnection: vi.fn(),
    onRemoveLandmark: vi.fn(),
    onEditLandmark: vi.fn(),
    onEditConnection: vi.fn(),
    onRemoveConnection: vi.fn(),
    onSetLandmarkMetric: vi.fn(),
    onClearLandmarkMetric: vi.fn(),
    loading: false as const,
  };

  it('renders landmark type', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('🏰 Keep')).toBeInTheDocument();
  });

  it('renders landmark name', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('Iron Keep')).toBeInTheDocument();
  });

  it('renders landmark id as slug in the edit dialog', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByText('tower-abc123')).toBeInTheDocument();
  });

  it('shows Edit and Create Connection buttons when owner', () => {
    setup('player-1');
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByTitle('Edit Element')).toBeInTheDocument();
    expect(screen.getByText('Create Connection')).toBeInTheDocument();
  });

  it('shows edit button and Create Connection for any collaborator', () => {
    setup('other-user');
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByTitle('Edit Element')).toBeInTheDocument();
    expect(screen.getByText('Create Connection')).toBeInTheDocument();
  });

  it('shows Remove Landmark button when owner', () => {
    setup('player-1');
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByText('Remove Element')).toBeInTheDocument();
  });

  it('shows Remove Landmark button for any collaborator', () => {
    setup('other-user');
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByText('Remove Element')).toBeInTheDocument();
  });

  it('calls onStartConnection when Create Connection is clicked', () => {
    setup();
    const onStartConnection = vi.fn();
    render(<LandmarkPanel {...defaultProps} onStartConnection={onStartConnection} />);
    fireEvent.click(screen.getByText('Create Connection'));
    fireEvent.click(screen.getByText('Select Target'));
    expect(onStartConnection).toHaveBeenCalledOnce();
  });

  it('calls onEditLandmark when Edit → Save is confirmed', () => {
    setup();
    const onEditLandmark = vi.fn();
    render(<LandmarkPanel {...defaultProps} onEditLandmark={onEditLandmark} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    fireEvent.click(screen.getByText('Save'));
    expect(onEditLandmark).toHaveBeenCalledWith(
      'tower-abc123',
      'Iron Keep',
      'KEEP',
      undefined,
      undefined,
      false,
      undefined,
      false,
      undefined,
      undefined,
      false,
      undefined,
      false,
    );
  });

  it('calls onRemoveLandmark when Remove Landmark is clicked', () => {
    setup();
    const onRemove = vi.fn();
    render(<LandmarkPanel {...defaultProps} onRemoveLandmark={onRemove} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    fireEvent.click(screen.getByText('Remove Element'));
    fireEvent.click(screen.getByText('Yes, remove'));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  // ── New field tests ──────────────────────────────────────────────────────────

  it('description textarea is visible in edit mode', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
  });

  it('passes description to onEditLandmark', () => {
    setup();
    const onEditLandmark = vi.fn();
    render(<LandmarkPanel {...defaultProps} onEditLandmark={onEditLandmark} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    fireEvent.change(screen.getByPlaceholderText('Description (optional)'), {
      target: { value: 'A great keep' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(onEditLandmark).toHaveBeenCalledWith(
      'tower-abc123',
      'Iron Keep',
      'KEEP',
      'A great keep',
      undefined,
      false,
      undefined,
      false,
      undefined,
      undefined,
      false,
      undefined,
      false,
    );
  });

  it('passes aliases to onEditLandmark and renders them in read mode', () => {
    setup('player-1', { aliases: ['alpha-keep', 'keep-1'] });
    const onEditLandmark = vi.fn();
    render(<LandmarkPanel {...defaultProps} onEditLandmark={onEditLandmark} />);
    expect(screen.getByText('alpha-keep')).toBeInTheDocument();
    expect(screen.getByText('keep-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Edit Element'));
    const aliasInput = screen.getByPlaceholderText('Aliases (comma-separated, optional)');
    expect(aliasInput).toHaveValue('alpha-keep, keep-1');
    fireEvent.change(aliasInput, {
      target: { value: 'new-alias, secondary-alias' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(onEditLandmark).toHaveBeenCalledWith(
      'tower-abc123',
      'Iron Keep',
      'KEEP',
      undefined,
      undefined,
      false,
      undefined,
      false,
      undefined,
      undefined,
      false,
      ['new-alias', 'secondary-alias'],
      false,
    );
  });

  it('ID is displayed as not editable in edit mode', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByText('ID (not editable):')).toBeInTheDocument();
    expect(screen.getAllByText('tower-abc123').length).toBeGreaterThan(0);
    // Must not be an input
    expect(screen.queryByDisplayValue('tower-abc123')).not.toBeInTheDocument();
  });

  it('group dropdown is populated from currentMap.groups', () => {
    setup();
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit Element'));
    expect(screen.getByText('— No group —')).toBeInTheDocument();
    expect(screen.getByText('Alpha Squad')).toBeInTheDocument();
  });

  it('existing description is shown in read mode', () => {
    setup('player-1', { description: 'A mighty fortress' });
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('A mighty fortress')).toBeInTheDocument();
  });

  it('existing group name is shown in read mode', () => {
    setup('player-1', { groupId: GROUP_ID });
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('Alpha Squad')).toBeInTheDocument();
  });
});

// ── Metric value editing: collaborator vs. viewer ─────────────────────────────

const METRIC = { id: 'met-1', name: 'Availability', description: 'Uptime %' };

function setupWithMetric(userId: string, isCollaborator: boolean) {
  useAuthStore.setState({ userId, username: 'test', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    selectedLandmark: { ...landmark },
    currentMap: {
      id: 'map-1',
      createdAt: '',
      collaborators: isCollaborator
        ? [{ id: userId, username: 'test' }]
        : [{ id: 'someone-else', username: 'other' }],
      landmarks: { 'tower-abc123': { ...landmark } },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
    metrics: { 'met-1': METRIC },
    mainView: 'landmark',
  });
}

describe('LandmarkPanel – metric value editing (collaborator)', () => {
  const defaultProps = {
    onStartConnection: vi.fn(),
    onRemoveLandmark: vi.fn(),
    onEditLandmark: vi.fn(),
    onEditConnection: vi.fn(),
    onRemoveConnection: vi.fn(),
    onSetLandmarkMetric: vi.fn(),
    onClearLandmarkMetric: vi.fn(),
    loading: false as const,
  };

  beforeEach(() => vi.clearAllMocks());

  it('metric row is clickable and opens the edit form for a collaborator', () => {
    setupWithMetric('player-1', true);
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle(`${METRIC.name}: ${METRIC.description}`));
    expect(screen.getByPlaceholderText('Value (e.g. 99.9 %)')).toBeInTheDocument();
  });

  it('shows four level buttons instead of a dropdown in the metric edit form', () => {
    setupWithMetric('player-1', true);
    render(<LandmarkPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle(`${METRIC.name}: ${METRIC.description}`));

    const noneButton = screen.getByRole('button', { name: 'Set quality level to None' });
    expect(noneButton).toBeInTheDocument();
    expect(noneButton.className).toContain('italic');
    expect(screen.getByRole('button', { name: 'Set quality level to OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set quality level to Warn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set quality level to Error' })).toBeInTheDocument();
  });

  it('calls onSetLandmarkMetric when the edit form is submitted', () => {
    setupWithMetric('player-1', true);
    const onSet = vi.fn();
    render(<LandmarkPanel {...defaultProps} onSetLandmarkMetric={onSet} />);
    fireEvent.click(screen.getByTitle(`${METRIC.name}: ${METRIC.description}`));
    fireEvent.change(screen.getByPlaceholderText('Value (e.g. 99.9 %)'), { target: { value: '99.9%' } });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(onSet).toHaveBeenCalledWith('tower-abc123', 'met-1', '99.9%', 'NONE', undefined, undefined, undefined);
  });

  it('lets collaborators choose the metric level via the level buttons', () => {
    setupWithMetric('player-1', true);
    const onSet = vi.fn();
    render(<LandmarkPanel {...defaultProps} onSetLandmarkMetric={onSet} />);
    fireEvent.click(screen.getByTitle(`${METRIC.name}: ${METRIC.description}`));
    fireEvent.click(screen.getByRole('button', { name: 'Set quality level to Error' }));
    fireEvent.submit(screen.getByPlaceholderText(/Leave empty to use "✘"/).closest('form')!);

    expect(onSet).toHaveBeenCalledWith('tower-abc123', 'met-1', '✘', 'ERROR', undefined, undefined, undefined);
  });

  it('shows the Clear (trash) button inside the metric dialog when an entry exists', () => {
    setupWithMetric('player-1', true);
    // set a metric entry on the landmark
    useMapStore.setState((s) => ({
      selectedLandmark: {
        ...s.selectedLandmark!,
        metrics: { 'met-1': { metricId: 'met-1', value: '99%', level: 'OK' as const } },
      },
    }));
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.queryByTitle('Clear metric value')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle(`${METRIC.name}: ${METRIC.description}`));
    expect(screen.getByTitle('Clear metric value')).toBeInTheDocument();
  });
});

describe('LandmarkPanel – metric value editing (non-collaborator / viewer)', () => {
  const defaultProps = {
    onStartConnection: vi.fn(),
    onRemoveLandmark: vi.fn(),
    onEditLandmark: vi.fn(),
    onEditConnection: vi.fn(),
    onRemoveConnection: vi.fn(),
    onSetLandmarkMetric: vi.fn(),
    onClearLandmarkMetric: vi.fn(),
    loading: false as const,
  };

  beforeEach(() => vi.clearAllMocks());

  it('metric row is NOT clickable for a non-collaborator', () => {
    setupWithMetric('viewer-99', false);
    render(<LandmarkPanel {...defaultProps} />);
    const row = screen.getByTitle(`${METRIC.name}: ${METRIC.description}`);
    expect(row).toBeInTheDocument();
    // clicking must not open the edit form
    fireEvent.click(row);
    expect(screen.queryByPlaceholderText('Value (e.g. 99.9 %)')).not.toBeInTheDocument();
  });

  it('does not render the Clear button even when an entry exists', () => {
    setupWithMetric('viewer-99', false);
    useMapStore.setState((s) => ({
      selectedLandmark: {
        ...s.selectedLandmark!,
        metrics: { 'met-1': { metricId: 'met-1', value: '99%', level: 'OK' as const } },
      },
    }));
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.queryByTitle('Clear metric value')).not.toBeInTheDocument();
  });

  it('metric value is still displayed in read-only mode', () => {
    setupWithMetric('viewer-99', false);
    useMapStore.setState((s) => ({
      selectedLandmark: {
        ...s.selectedLandmark!,
        metrics: { 'met-1': { metricId: 'met-1', value: '42%', level: 'OK' as const } },
      },
    }));
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });
});

// ── Collaborator Matrix ───────────────────────────────────────────────────────

const MATRIX_LANDMARK_ID = landmark.id; // 'tower-abc123'

const MATRIX: CollaboratorMatrix = {
  name: 'Bus Matrix',
  collaborators: ['player-1', 'player-2'],
  entries: {
    [MATRIX_LANDMARK_ID]: {
      'player-1': { level: 'HIGH' },
      'player-2': { level: 'LOW' },
    },
  },
};

function setupWithMatrix(matrix?: CollaboratorMatrix) {
  useAuthStore.setState({ userId: 'player-1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    selectedLandmark: { ...landmark },
    currentMap: {
      id: 'map-1',
      createdAt: '',
      collaborators: [
        { id: 'player-1', username: 'alice' },
        { id: 'player-2', username: 'bob' },
      ],
      landmarks: { [MATRIX_LANDMARK_ID]: { ...landmark } },
      connections: {},
      groups: {},
      map: { tiles: [] },
    },
    collaboratorMatrix: matrix ?? null,
    mainView: 'landmark',
  });
}

describe('LandmarkPanel – collaborator matrix section', () => {
  const defaultProps = {
    onStartConnection: vi.fn(),
    onRemoveLandmark: vi.fn(),
    onEditLandmark: vi.fn(),
    onEditConnection: vi.fn(),
    onRemoveConnection: vi.fn(),
    onSetLandmarkMetric: vi.fn(),
    onClearLandmarkMetric: vi.fn(),
    loading: false as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({ selectedLandmark: undefined, currentMap: undefined });
  });

  it('does not render matrix section when no collaboratorMatrix is defined', () => {
    setupWithMatrix(undefined);
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.queryByText('Bus Matrix')).not.toBeInTheDocument();
  });

  it('does not render matrix section when all entries are NONE', () => {
    setupWithMatrix({
      name: 'Bus Matrix',
      collaborators: ['player-1', 'player-2'],
      entries: {
        [MATRIX_LANDMARK_ID]: {
          'player-1': { level: 'NONE' },
          'player-2': { level: 'NONE' },
        },
      },
    });
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.queryByText('Bus Matrix')).not.toBeInTheDocument();
  });

  it('renders matrix section heading', () => {
    setupWithMatrix(MATRIX);
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('Collaborators')).toBeInTheDocument();
  });

  it('renders a row for each collaborator with a non-NONE level', () => {
    setupWithMatrix(MATRIX);
    render(<LandmarkPanel {...defaultProps} />);
    // Both alice (HIGH) and bob (LOW) have non-NONE entries → both rows appear
    // alice also appears as owner label, so use getAllByText
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bob').length).toBeGreaterThan(0);
  });

  it('displays the correct level badge for each collaborator', () => {
    setupWithMatrix(MATRIX);
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.getByText('Expert')).toBeInTheDocument();   // HIGH → alice
    expect(screen.getByText('Beginner')).toBeInTheDocument(); // LOW  → bob
  });

  it('does not render collaborators whose level is NONE', () => {
    setupWithMatrix({
      name: 'Bus Matrix',
      collaborators: ['player-1', 'player-2'],
      entries: {
        [MATRIX_LANDMARK_ID]: {
          'player-1': { level: 'HIGH' },
          'player-2': { level: 'NONE' },
        },
      },
    });
    render(<LandmarkPanel {...defaultProps} />);
    // alice has HIGH → appears (at least once in matrix row, possibly also as owner)
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
    // bob has NONE → must NOT appear in the matrix section as a visible text node (only option elements from owner dropdown are allowed)
    const bobElements = screen.queryAllByText('bob');
    const bobVisibleSpans = bobElements.filter((el) => el.tagName.toLowerCase() === 'span');
    expect(bobVisibleSpans).toHaveLength(0);
  });

  it('does not render matrix section for a WALL (decorative) landmark', () => {
    useAuthStore.setState({ userId: 'player-1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      selectedLandmark: { ...landmark, type: 'WALL' },
      currentMap: {
        id: 'map-1',
        createdAt: '',
        collaborators: [{ id: 'player-1', username: 'alice' }],
        landmarks: { [MATRIX_LANDMARK_ID]: { ...landmark, type: 'WALL' } },
        connections: {},
        groups: {},
        map: { tiles: [] },
      },
      mainView: 'landmark',
    });
    render(<LandmarkPanel {...defaultProps} />);
    expect(screen.queryByText('Bus Matrix')).not.toBeInTheDocument();
  });

  it('renders avatar fallback initials when no avatarUrl', () => {
    setupWithMatrix(MATRIX);
    render(<LandmarkPanel {...defaultProps} />);
    // Fallback shows first two letters of username uppercased: 'alice' → 'AL'
    const initials = screen.getAllByText('AL');
    expect(initials.length).toBeGreaterThan(0);
  });

  it('renders avatar username when avatarUrl is provided', () => {
    useAuthStore.setState({ userId: 'player-1', username: 'alice', token: 'tok', isAuthenticated: true });
    useMapStore.setState({
      selectedLandmark: { ...landmark },
      currentMap: {
        id: 'map-1',
        createdAt: '',
        collaborators: [
          { id: 'player-1', username: 'alice', avatarUrl: 'https://example.com/alice.png' },
        ],
        landmarks: { [MATRIX_LANDMARK_ID]: { ...landmark } },
        connections: {},
        groups: {},
        map: { tiles: [] },
      },
      collaboratorMatrix: {
        name: 'Bus Matrix',
        collaborators: ['player-1'],
        entries: { [MATRIX_LANDMARK_ID]: { 'player-1': { level: 'MEDIUM' } } },
      },
      mainView: 'landmark',
    });
    render(<LandmarkPanel {...defaultProps} />);
    // UserAvatar renders the username as visible text
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
  });
});

