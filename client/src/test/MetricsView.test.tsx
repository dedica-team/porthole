import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetricsView from '../components/MetricsView/MetricsView';
import { useMapStore, useAuthStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';
import type {Landmark, LandmarkGroup, QualityMetric} from '../types/landmark';
import * as MapActionsContext from '../pages/MapPage/MapActionsContext';
// ── shared fixtures ────────────────────────────────────────────────────────

const METRIC_AVAIL = { id: 'm1', name: 'Availability', description: 'Uptime %' };
const METRIC_COVERAGE = { id: 'm2', name: 'Coverage', description: 'Test coverage %' };

const GROUP_A: LandmarkGroup = { id: 'g1', name: 'Alpha', color: '#e74c3c' };
const GROUP_B: LandmarkGroup = { id: 'g2', name: 'Beta',  color: '#3498db' };

const LM_IN_A   = { id: 'lm1', name: 'Keep',       ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP',       groupId: 'g1', metrics: {} };
const LM_IN_B   = { id: 'lm2', name: 'Lighthouse', ownerId: 'p1', coordinate: { q: 1, r: 0 }, type: 'LIGHTHOUSE', groupId: 'g2', metrics: {} };
const LM_NONE   = { id: 'lm3', name: 'Ruins',      ownerId: 'p1', coordinate: { q: 2, r: 0 }, type: 'RUINS',                     metrics: {} };

const MAP_BASE = {
  id: 'map-1',
  createdAt: '',
  collaborators: [{ id: 'p1', username: 'alice' }],
  connections: {},
  map: { tiles: [] },
};

// mockActions is mutated per-test for handler overrides
const mockActions = {
  handleCreateMetric: vi.fn(),
  handleCreateUnpositionedLandmark: vi.fn(),
  handleEditMetric: vi.fn(),
  handleRemoveMetric: vi.fn(),
  handleSetLandmarkMetric: vi.fn(),
  handleClearLandmarkMetric: vi.fn(),
  handleEditLandmarkGroup: vi.fn(),
  handleEditLandmark: vi.fn(),
  handleCreateGroup: vi.fn(),
  handleEditGroup: vi.fn(),
  handleRemoveGroup: vi.fn(),
  handleRemoveLandmark: vi.fn(),
  actionLoading: false,
  error: '',
  setError: vi.fn(),
  withAction: vi.fn(),
  cancelConnecting: vi.fn(),
  fireEditTile: vi.fn(),
  landmarkByCoord: vi.fn(),
  tileByCoord: vi.fn(),
  positionedLandmarks: [],
  handlePlaceLandmark: vi.fn(),
  handlePositionLandmark: vi.fn(),
  handleStartConnection: vi.fn(),
  handleEditConnection: vi.fn(),
  handleRemoveConnection: vi.fn(),
  handleCreateConnection: vi.fn(),
  handleEditCollaboratorMatrix: vi.fn(),
  handleSetMatrixEntry: vi.fn(),
  handleClearMatrixEntry: vi.fn(),
};

function setup(
  metrics: Record<string, QualityMetric> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  landmarks: Record<string, any> = {},
  groups: Record<string, LandmarkGroup> = {},
) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({ currentMap: { ...MAP_BASE, landmarks, groups }, metrics });
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('MetricsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock action fns
    Object.keys(mockActions).forEach((k) => {
      const v = (mockActions as Record<string, unknown>)[k];
      if (typeof v === 'function') (v as ReturnType<typeof vi.fn>).mockReset();
    });
    mockActions.actionLoading = false;
    mockActions.error = '';
    vi.spyOn(MapActionsContext, 'useMapActions').mockReturnValue(mockActions as unknown as ReturnType<typeof MapActionsContext.useMapActions>);
  });
  afterEach(() => vi.restoreAllMocks());

  // ── empty state ───────────────────────────────────────────────────────────

  it('shows empty state when no metrics and no landmarks exist', () => {
    setup();
    render(<MetricsView />);
    expect(screen.getByText(/no metrics defined yet/i)).toBeInTheDocument();
  });

  it('shows the table when metrics exist', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
  });


  // ── + button opens template selector ─────────────────────────────────────

  it('header "Add Metric" button opens the template selector dialog', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Add metric'));
    // Dialog opens – title and form become visible
    await waitFor(() => expect(screen.getByRole('heading', { name: /add metric/i })).toBeInTheDocument());
  });

  it('selecting a template pre-fills the form fields', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Codebase');
    const descInput = screen.getByPlaceholderText(/description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe('One codebase.');
  });

  it('user can modify pre-filled fields before submitting', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    mockActions.handleCreateMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i);
    fireEvent.change(nameInput, { target: { value: 'My Custom Name' } });
    fireEvent.submit(nameInput.closest('form')!);
    expect(mockActions.handleCreateMetric).toHaveBeenCalledWith('My Custom Name', 'One codebase.');
  });

  it('manual entry in form calls onCreateMetric', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    mockActions.handleCreateMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/name.*availability/i), { target: { value: 'SLA' } });
    fireEvent.submit(screen.getByPlaceholderText(/name.*availability/i).closest('form')!);
    expect(mockActions.handleCreateMetric).toHaveBeenCalledWith('SLA', '');
  });

  it('cancel button hides the dialog', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    const form = screen.getByPlaceholderText(/name.*availability/i).closest('form')!;
    fireEvent.click(form.querySelector('button[type="button"]') as HTMLElement);
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/name.*availability/i)).not.toBeInTheDocument(),
    );
  });

  // ── group headers ─────────────────────────────────────────────────────────

  it('renders a group header row for each group that has landmarks', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A, lm2: LM_IN_B },
      { g1: GROUP_A, g2: GROUP_B },
    );
    render(<MetricsView />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
  });

  it('does not render a group header for a group that has no landmarks', () => {
    // GROUP_B has no landmarks assigned
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A },
      { g1: GROUP_A, g2: GROUP_B },
    );
    render(<MetricsView />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('renders an Ungrouped header when at least one landmark has no group', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A, lm3: LM_NONE },
      { g1: GROUP_A },
    );
    render(<MetricsView />);
    expect(screen.getByText(/ungrouped/i)).toBeInTheDocument();
  });

  it('does not render Ungrouped header when all landmarks are in a group', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A },
      { g1: GROUP_A },
    );
    render(<MetricsView />);
    expect(screen.queryByText(/ungrouped/i)).not.toBeInTheDocument();
  });

  it('landmark rows appear under the correct group header', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A, lm2: LM_IN_B },
      { g1: GROUP_A, g2: GROUP_B },
    );
    render(<MetricsView />);
    // Both landmark names should appear
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
  });

  // ── cell interactions ─────────────────────────────────────────────────────

  it('clicking a cell opens the edit form', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);
    const cell = screen.getByTitle('Click to set value');
    fireEvent.click(cell);
    expect(screen.getByPlaceholderText('Value (e.g. 99.9 %)')).toBeInTheDocument();
  });

  it('shows four level buttons instead of a dropdown in the cell edit form', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));

    const noneButton = screen.getByRole('button', { name: 'Set quality level to None' });
    expect(noneButton).toBeInTheDocument();
    expect(noneButton.className).toContain('italic');
    expect(screen.getByRole('button', { name: 'Set quality level to OK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set quality level to Warn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set quality level to Error' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('submitting a cell edit calls onSetLandmarkMetric', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Value (e.g. 99.9 %)'), { target: { value: '99.9%' } });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', '99.9%', 'NONE', undefined, undefined, undefined, undefined);
  });

  it('lets users choose the metric level via the level buttons', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.click(screen.getByRole('button', { name: 'Set quality level to Error' }));
    fireEvent.submit(screen.getByPlaceholderText(/Leave empty to use "✘"/).closest('form')!);

    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', '✘', 'ERROR', undefined, undefined, undefined, undefined);
  });

  it('adding a badge row and submitting passes the badges map to onSetLandmarkMetric', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Value (e.g. 99.9 %)'), { target: { value: '99.9%' } });
    // click "Add badge" to get a row
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'build' } });
    fireEvent.change(screen.getByPlaceholderText('Badge URL (https://…)'), {
      target: { value: 'https://img.shields.io/badge/build-passing-green' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', '99.9%', 'NONE', undefined, undefined, {
      build: 'https://img.shields.io/badge/build-passing-green',
    }, undefined);
  });

  it('submitting with only a badge row (no value) passes undefined value', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.click(screen.getByText('+ Add'));
    fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'coverage' } });
    fireEvent.change(screen.getByPlaceholderText('Badge URL (https://…)'), {
      target: { value: 'https://img.shields.io/badge/coverage-80%25-yellow' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', undefined, 'NONE', undefined, undefined, {
      coverage: 'https://img.shields.io/badge/coverage-80%25-yellow',
    }, undefined);
  });

  it('submitting with only a link passes an undefined value and preserves the link', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Link (optional, https://…)'), {
      target: { value: 'https://example.com/report' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', undefined, 'NONE', 'https://example.com/report', undefined, undefined, undefined);
  });

  it('submitting with a link text passes it alongside the link', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleSetLandmarkMetric = vi.fn();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Link (optional, https://…)'), {
      target: { value: 'https://example.com/report' },
    });
    fireEvent.change(screen.getByPlaceholderText('Link text (optional)'), {
      target: { value: 'Availability report' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(mockActions.handleSetLandmarkMetric).toHaveBeenCalledWith('lm1', 'm1', undefined, 'NONE', 'https://example.com/report', 'Availability report', undefined, undefined);
  });

  it('displays each badge in the badges map as an img tag', () => {
    const lmWithBadges = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          value: '99.9%',
          level: 'OK',
          badges: {
            build:    'https://img.shields.io/badge/build-passing-green',
            coverage: 'https://img.shields.io/badge/coverage-80%25-yellow',
          },
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithBadges }, { g1: GROUP_A });
    render(<MetricsView />);
    const buildImg = screen.getByRole('img', { name: 'build' }) as HTMLImageElement;
    expect(buildImg).toBeInTheDocument();
    expect(buildImg.src).toBe('https://img.shields.io/badge/build-passing-green');
    const covImg = screen.getByRole('img', { name: 'coverage' }) as HTMLImageElement;
    expect(covImg).toBeInTheDocument();
    expect(covImg.src).toBe('https://img.shields.io/badge/coverage-80%25-yellow');
  });

  it('shows metric cell links as truncated url text when no link text is set', () => {
    const link = 'https://example.com/reports/availability/current-build/details';
    const lmWithLink = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          value: '99.9%',
          level: 'OK',
          link,
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithLink }, { g1: GROUP_A });
    render(<MetricsView />);

    const metricLink = screen.getByRole('link', { name: link });
    expect(metricLink).toBeInTheDocument();
    expect(metricLink).toHaveAttribute('href', link);
    expect(metricLink).toHaveAttribute('title', link);
    expect(metricLink.className).toContain('truncate');
    expect(metricLink.textContent).toBe(link);
  });

  it('shows linkText instead of the raw url in the matrix when provided', () => {
    const link = 'https://example.com/reports/availability/current-build/details';
    const lmWithLink = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          level: 'NONE',
          link,
          linkText: 'Open availability report',
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithLink }, { g1: GROUP_A });
    render(<MetricsView />);

    const metricLink = screen.getByRole('link', { name: 'Open availability report' });
    expect(metricLink).toBeInTheDocument();
    expect(metricLink).toHaveAttribute('href', link);
    expect(metricLink).toHaveAttribute('title', link);
    expect(metricLink.textContent).toBe('Open availability report');
  });

  it('renders an existing value for level NONE in the table using the same appearance as in the edit dialog', () => {
    const lmWithNoneValue = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          value: 'Manual note',
          level: 'NONE',
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithNoneValue }, { g1: GROUP_A });
    render(<MetricsView />);

    const valueEl = screen.getByText('Manual note');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl.className).toContain('italic');
    expect(valueEl.className).toContain('rounded');
    expect(valueEl.className).toContain('border');
  });

  it('does not render extra badge label text next to badge images in the metric cell', () => {
    const lmWithBadges = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          level: 'NONE',
          badges: {
            build: 'https://img.shields.io/badge/build-passing-green',
          },
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithBadges }, { g1: GROUP_A });
    render(<MetricsView />);
    expect(screen.getByRole('img', { name: 'build' })).toBeInTheDocument();
    expect(screen.queryByText('build')).not.toBeInTheDocument();
  });

  it('displays only the badge imgs when no value and level is NONE', () => {
    const lmBadgeOnly = {
      ...LM_IN_A,
      metrics: {
        m1: {
          metricId: 'm1',
          level: 'NONE',
          badges: { status: 'https://img.shields.io/badge/status-ok-green' },
        },
      },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmBadgeOnly }, { g1: GROUP_A });
    render(<MetricsView />);
    const img = screen.getByRole('img', { name: 'status' }) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://img.shields.io/badge/status-ok-green');
    expect(screen.queryByText('not set')).not.toBeInTheDocument();
  });

  it('cancelling a cell edit hides the form', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    expect(screen.getByPlaceholderText('Value (e.g. 99.9 %)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByPlaceholderText('Value (e.g. 99.9 %)')).not.toBeInTheDocument();
  });

  // ── error alert ───────────────────────────────────────────────────────────

  it('shows the error alert when error prop is set', () => {
    setup();
    mockActions.error = 'Something went wrong';
    render(<MetricsView />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onClearError when the dismiss button is clicked', () => {
    setup();
    mockActions.error = 'Oops';
    mockActions.setError = vi.fn();
    render(<MetricsView />);
    // The X button inside the alert
    const dismissBtn = screen.getAllByRole('button').find(
      (b) => b.closest('[role="alert"]'),
    );
    if (dismissBtn) fireEvent.click(dismissBtn);
    expect(mockActions.setError).toHaveBeenCalled();
  });

  // ── existing metric entry display ─────────────────────────────────────────

  it('displays an existing metric entry value in the cell', () => {
    const lmWithMetric = {
      ...LM_IN_A,
      metrics: { m1: { metricId: 'm1', value: '99.9%', level: 'OK' } },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithMetric }, { g1: GROUP_A });
    render(<MetricsView />);
    expect(screen.getByText('99.9%')).toBeInTheDocument();
  });

  it('shows the Overall badge for a landmark with a non-NONE metric level', () => {
    const lmWithMetric = {
      ...LM_IN_A,
      metrics: { m1: { metricId: 'm1', level: 'ERROR' } },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithMetric }, { g1: GROUP_A });
    render(<MetricsView />);
    // Cell shows the sign symbol (✘ for ERROR) when no value is set
    expect(screen.getAllByText('✘').length).toBeGreaterThanOrEqual(1);
  });

  it('bases the landmark summary badge only on currently visible metrics', () => {
    const lmWithMetrics = {
      ...LM_IN_A,
      metrics: {
        m1: { metricId: 'm1', level: 'ERROR' },
        m2: { metricId: 'm2', level: 'OK' },
      },
    };
    setup({ m1: METRIC_AVAIL, m2: METRIC_COVERAGE }, { lm1: lmWithMetrics }, { g1: GROUP_A });
    render(<MetricsView />);

    expect(screen.getAllByText('✘').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByTitle('Filter table'));
    const availabilityBtn = screen.getAllByText('Availability')
      .filter((el) => el.closest('button') !== null)
      .map((el) => el.closest('button')!)
      .at(-1)!;
    fireEvent.click(availabilityBtn);
    fireEvent.click(screen.getByTitle(/filters active/i));

    expect(screen.queryByText('✘')).not.toBeInTheDocument();
    expect(screen.getByText('✔')).toBeInTheDocument();
  });

  // ── group filter ──────────────────────────────────────────────────────────

      beforeEach(() => {
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    localStorage.removeItem('landmarks.metrics.hiddenMetrics');
  });

  it('renders the filter icon button in the table header', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    expect(screen.getByTitle('Filter table')).toBeInTheDocument();
  });

  it('clicking the filter button opens the combined filter popover', () => {
    setup({ m1: METRIC_AVAIL, m2: METRIC_COVERAGE }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Filter table'));
    expect(screen.getByText(/filter table/i)).toBeInTheDocument();
    expect(screen.getByText(/show groups/i)).toBeInTheDocument();
    expect(screen.getByText(/show metrics/i)).toBeInTheDocument();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Availability').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Coverage').length).toBeGreaterThan(0);
  });

  it('toggling a group off hides its landmark rows', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    // open popover
    fireEvent.click(screen.getByTitle('Filter table'));
    // click the "Alpha" row to hide it
    const alphaBtn = screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn);
    // lm1 ("Keep") belongs to group Alpha → should be gone
    expect(screen.queryByText('Keep')).not.toBeInTheDocument();
    // lm2 ("Lighthouse") belongs to group Beta → still visible
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
  });

  it('re-toggling a hidden group makes its rows reappear', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    const filterBtn = () =>
      screen.queryByTitle('Filter table') ?? screen.getByTitle(/filters active/i);
    fireEvent.click(filterBtn());
    // hide Alpha
    const alphaBtn = () => screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn());
    expect(screen.queryByText('Keep')).not.toBeInTheDocument();
    // show Alpha again
    fireEvent.click(alphaBtn());
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('"Show all" button restores all hidden groups', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    const filterBtn = () =>
      screen.queryByTitle('Filter table') ?? screen.getByTitle(/filters active/i);
    fireEvent.click(filterBtn());
    // hide both groups via popover buttons
    const groupBtns = () =>
      screen.getAllByText(/^(Alpha|Beta)$/).filter(
        (el) => el.closest('button') !== null,
      ).map((el) => el.closest('button')!);
    groupBtns().forEach((b) => fireEvent.click(b));
    expect(screen.queryByText('Keep')).not.toBeInTheDocument();
    expect(screen.queryByText('Lighthouse')).not.toBeInTheDocument();
    // restore via "Show all"
    fireEvent.click(screen.getByRole('button', { name: /show all/i }));
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
  });

  it('filter icon title changes to active state when a group is hidden', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Filter table'));
    const alphaBtn = screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn);
    expect(screen.getByTitle(/filters active/i)).toBeInTheDocument();
  });

  it('toggling a metric off hides its column while keeping other metrics visible', () => {
    const lmWithMetrics = {
      ...LM_IN_A,
      metrics: {
        m1: { metricId: 'm1', value: '99.9%', level: 'OK' },
        m2: { metricId: 'm2', value: '87%', level: 'WARN' },
      },
    };
    setup({ m1: METRIC_AVAIL, m2: METRIC_COVERAGE }, { lm1: lmWithMetrics }, { g1: GROUP_A });
    render(<MetricsView />);

    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Coverage')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Filter table'));
    const coverageBtn = screen.getAllByText('Coverage')
      .filter((el) => el.closest('button') !== null)
      .map((el) => el.closest('button')!)
      .at(-1)!;
    fireEvent.click(coverageBtn);
    fireEvent.click(screen.getByTitle(/filters active/i));

    expect(screen.queryByText('Coverage')).not.toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.queryByText('87%')).not.toBeInTheDocument();
    expect(screen.getByText('99.9%')).toBeInTheDocument();
  });

  // ── help button ───────────────────────────────────────────────────────────

  it('renders the help button in the header', () => {
    setup();
    render(<MetricsView />);
    expect(screen.getByTitle('Help')).toBeInTheDocument();
  });

  it('clicking the help button opens the usage popover', async () => {
    setup();
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Help'));
    await waitFor(() =>
      expect(screen.getByText(/how to use metrics/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/quality dimensions you define/i)).toBeInTheDocument();
    expect(screen.getByText(/things being measured/i)).toBeInTheDocument();
  });

  // ── landmark removal ───────────────────────────────────────────────────────

  it('clicking "Remove" for an unpositioned landmark shows confirmation and calls onRemoveLandmark', async () => {
    const unpositionedLm: Landmark = { id: 'up1', name: 'Ghost', type: 'KEEP', ownerId: null};
    setup({ m1: METRIC_AVAIL }, { up1: unpositionedLm }, { g1: GROUP_A });
    mockActions.handleRemoveLandmark = vi.fn();
    render(<MetricsView />);

    // Click on unpositioned landmark name to open the LandmarkInfoPopover
    fireEvent.click(screen.getByText('Ghost'));

    // Click the "Edit Landmark" pencil button in the popover
    fireEvent.click(screen.getByTitle('Edit Landmark'));

    // Click "Remove" button
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    // Verify confirmation is shown
    expect(screen.getByText(/remove «Ghost»\?/i)).toBeInTheDocument();

    // Click "Yes, remove"
    fireEvent.click(screen.getByRole('button', { name: /yes, remove/i }));

    expect(mockActions.handleRemoveLandmark).toHaveBeenCalledWith('up1');
  });

  it('clicking "Remove Landmark" in the LandmarkInfoPopover shows confirmation and calls onRemoveLandmark', async () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    mockActions.handleRemoveLandmark = vi.fn();
    render(<MetricsView />);

    // Click on landmark name to open info popover
    fireEvent.click(screen.getByText('Keep'));

    // Click "Edit" icon (pencil) to go to edit state
    const editBtn = screen.getByTitle('Edit Landmark');
    fireEvent.click(editBtn);

    // Click "Remove Landmark" button
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    // Verify confirmation is shown
    expect(screen.getByText(/remove «Keep»\?/i)).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();

    // Click "Yes, remove"
    fireEvent.click(screen.getByRole('button', { name: /yes, remove/i }));

    expect(mockActions.handleRemoveLandmark).toHaveBeenCalledWith('lm1');
  });

  it('cancelling landmark removal returns to the edit form', async () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);

    fireEvent.click(screen.getByText('Keep'));
    const editBtn = screen.getByTitle('Edit Landmark');
    fireEvent.click(editBtn);

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.getByText(/remove «Keep»\?/i)).toBeInTheDocument();

    // Click "Cancel" in confirmation
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Verify we are back in the edit form (input should be visible)
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.queryByText(/remove «Keep»\?/i)).not.toBeInTheDocument();
  });

  it('persists hidden groups to localStorage', () => {
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    localStorage.removeItem('landmarks.metrics.hiddenMetrics');
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Filter table'));
    const alphaBtn = screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn);
    const stored = JSON.parse(localStorage.getItem('landmarks.metrics.hiddenGroups')!);
    expect(stored).toContain('g1');
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    localStorage.removeItem('landmarks.metrics.hiddenMetrics');
  });

  it('persists hidden metrics to localStorage', () => {
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    localStorage.removeItem('landmarks.metrics.hiddenMetrics');
    setup({ m1: METRIC_AVAIL, m2: METRIC_COVERAGE }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView />);
    fireEvent.click(screen.getByTitle('Filter table'));
    const coverageBtn = screen.getAllByText('Coverage')
      .filter((el) => el.closest('button') !== null)
      .map((el) => el.closest('button')!)
      .at(-1)!;
    fireEvent.click(coverageBtn);
    const stored = JSON.parse(localStorage.getItem('landmarks.metrics.hiddenMetrics')!);
    expect(stored).toContain('m2');
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    localStorage.removeItem('landmarks.metrics.hiddenMetrics');
  });
});

