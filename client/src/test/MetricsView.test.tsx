import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetricsView from '../components/MetricsView/MetricsView';
import { useMapStore, useAuthStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';
import type {LandmarkGroup, QualityMetric} from '../types/map';

// ── shared fixtures ────────────────────────────────────────────────────────

const METRIC_AVAIL = { id: 'm1', name: 'Availability', description: 'Uptime %' };

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

const DEFAULT_PROPS = {
  onCreateMetric: vi.fn(),
  onCreateUnpositionedLandmark: vi.fn(),
  onEditMetric: vi.fn(),
  onRemoveMetric: vi.fn(),
  onSetLandmarkMetric: vi.fn(),
  onClearLandmarkMetric: vi.fn(),
  onEditLandmarkGroup: vi.fn(),
  onEditLandmark: vi.fn(),
  onCreateGroup: vi.fn(),
  onEditGroup: vi.fn(),
  onRemoveGroup: vi.fn(),
  loading: false,
};

function setup(
  metrics: Record<string, QualityMetric> = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  landmarks: Record<string, any> = {},
  groups: Record<string, LandmarkGroup> = {},
) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({ currentMap: { ...MAP_BASE, metrics, landmarks, groups } });
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('MetricsView', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  // ── empty state ───────────────────────────────────────────────────────────

  it('shows empty state when no metrics and no landmarks exist', () => {
    setup();
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByText(/no metrics defined yet/i)).toBeInTheDocument();
  });

  it('shows the table when metrics exist', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
  });


  // ── + button opens template selector ─────────────────────────────────────

  it('header "Add Metric" button opens the template selector dialog', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Add metric'));
    // Dialog opens – title and form become visible
    await waitFor(() => expect(screen.getByRole('heading', { name: /add metric/i })).toBeInTheDocument());
  });

  it('selecting a template pre-fills the form fields', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
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
    const onCreate = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} onCreateMetric={onCreate} />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i);
    fireEvent.change(nameInput, { target: { value: 'My Custom Name' } });
    fireEvent.submit(nameInput.closest('form')!);
    expect(onCreate).toHaveBeenCalledWith('My Custom Name', 'One codebase.');
  });

  it('manual entry in form calls onCreateMetric', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    const onCreate = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} onCreateMetric={onCreate} />);
    fireEvent.click(screen.getByTitle('Add metric'));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/name.*availability/i), { target: { value: 'SLA' } });
    fireEvent.submit(screen.getByPlaceholderText(/name.*availability/i).closest('form')!);
    expect(onCreate).toHaveBeenCalledWith('SLA', '');
  });

  it('cancel button hides the dialog', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue([
      { id: 'codebase', name: 'Codebase', description: 'One codebase.' },
    ]);
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
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
    render(<MetricsView {...DEFAULT_PROPS} />);
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
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('renders an Ungrouped header when at least one landmark has no group', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A, lm3: LM_NONE },
      { g1: GROUP_A },
    );
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByText(/ungrouped/i)).toBeInTheDocument();
  });

  it('does not render Ungrouped header when all landmarks are in a group', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A },
      { g1: GROUP_A },
    );
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/ungrouped/i)).not.toBeInTheDocument();
  });

  it('landmark rows appear under the correct group header', () => {
    setup(
      { m1: METRIC_AVAIL },
      { lm1: LM_IN_A, lm2: LM_IN_B },
      { g1: GROUP_A, g2: GROUP_B },
    );
    render(<MetricsView {...DEFAULT_PROPS} />);
    // Both landmark names should appear
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Lighthouse')).toBeInTheDocument();
  });

  // ── cell interactions ─────────────────────────────────────────────────────

  it('clicking a cell opens the edit form', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    const cell = screen.getByTitle('Click to set value');
    fireEvent.click(cell);
    expect(screen.getByPlaceholderText('Value (e.g. 99.9 %)')).toBeInTheDocument();
  });

  it('submitting a cell edit calls onSetLandmarkMetric', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    const onSet = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} onSetLandmarkMetric={onSet} />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Value (e.g. 99.9 %)'), { target: { value: '99.9%' } });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(onSet).toHaveBeenCalledWith('lm1', 'm1', '99.9%', 'NONE', undefined, undefined);
  });

  it('adding a badge row and submitting passes the badges map to onSetLandmarkMetric', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    const onSet = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} onSetLandmarkMetric={onSet} />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.change(screen.getByPlaceholderText('Value (e.g. 99.9 %)'), { target: { value: '99.9%' } });
    // click "Add badge" to get a row
    fireEvent.click(screen.getByText('+ Add badge'));
    fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'build' } });
    fireEvent.change(screen.getByPlaceholderText('Badge URL (https://…)'), {
      target: { value: 'https://img.shields.io/badge/build-passing-green' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(onSet).toHaveBeenCalledWith('lm1', 'm1', '99.9%', 'NONE', undefined, {
      build: 'https://img.shields.io/badge/build-passing-green',
    });
  });

  it('submitting with only a badge row (no value) passes undefined value', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    const onSet = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} onSetLandmarkMetric={onSet} />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    fireEvent.click(screen.getByText('+ Add badge'));
    fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'coverage' } });
    fireEvent.change(screen.getByPlaceholderText('Badge URL (https://…)'), {
      target: { value: 'https://img.shields.io/badge/coverage-80%25-yellow' },
    });
    fireEvent.submit(screen.getByPlaceholderText('Value (e.g. 99.9 %)').closest('form')!);
    expect(onSet).toHaveBeenCalledWith('lm1', 'm1', undefined, 'NONE', undefined, {
      coverage: 'https://img.shields.io/badge/coverage-80%25-yellow',
    });
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
    render(<MetricsView {...DEFAULT_PROPS} />);
    const buildImg = screen.getByRole('img', { name: 'build' }) as HTMLImageElement;
    expect(buildImg).toBeInTheDocument();
    expect(buildImg.src).toBe('https://img.shields.io/badge/build-passing-green');
    const covImg = screen.getByRole('img', { name: 'coverage' }) as HTMLImageElement;
    expect(covImg).toBeInTheDocument();
    expect(covImg.src).toBe('https://img.shields.io/badge/coverage-80%25-yellow');
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
    render(<MetricsView {...DEFAULT_PROPS} />);
    const img = screen.getByRole('img', { name: 'status' }) as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://img.shields.io/badge/status-ok-green');
    expect(screen.queryByText('not set')).not.toBeInTheDocument();
  });

  it('cancelling a cell edit hides the form', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Click to set value'));
    expect(screen.getByPlaceholderText('Value (e.g. 99.9 %)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText('Value (e.g. 99.9 %)')).not.toBeInTheDocument();
  });

  // ── error alert ───────────────────────────────────────────────────────────

  it('shows the error alert when error prop is set', () => {
    setup();
    render(<MetricsView {...DEFAULT_PROPS} error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onClearError when the dismiss button is clicked', () => {
    setup();
    const onClear = vi.fn();
    render(<MetricsView {...DEFAULT_PROPS} error="Oops" onClearError={onClear} />);
    // The X button inside the alert
    const dismissBtn = screen.getAllByRole('button').find(
      (b) => b.closest('[role="alert"]'),
    );
    if (dismissBtn) fireEvent.click(dismissBtn);
    expect(onClear).toHaveBeenCalled();
  });

  // ── existing metric entry display ─────────────────────────────────────────

  it('displays an existing metric entry value in the cell', () => {
    const lmWithMetric = {
      ...LM_IN_A,
      metrics: { m1: { metricId: 'm1', value: '99.9%', level: 'OK' } },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithMetric }, { g1: GROUP_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByText('99.9%')).toBeInTheDocument();
  });

  it('shows the Overall badge for a landmark with a non-NONE metric level', () => {
    const lmWithMetric = {
      ...LM_IN_A,
      metrics: { m1: { metricId: 'm1', value: '50%', level: 'ERROR' } },
    };
    setup({ m1: METRIC_AVAIL }, { lm1: lmWithMetric }, { g1: GROUP_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    // Overall badge now shows the sign symbol (✘ for ERROR) rather than the word
    expect(screen.getAllByText('✘').length).toBeGreaterThanOrEqual(1);
  });

  // ── group filter ──────────────────────────────────────────────────────────

      beforeEach(() => {
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
  });

  it('renders the filter icon button in the table header', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByTitle('Filter groups')).toBeInTheDocument();
  });

  it('clicking the filter button opens the group popover', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Filter groups'));
    expect(screen.getByText(/show groups/i)).toBeInTheDocument();
    expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
  });

  it('toggling a group off hides its landmark rows', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView {...DEFAULT_PROPS} />);
    // open popover
    fireEvent.click(screen.getByTitle('Filter groups'));
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
    render(<MetricsView {...DEFAULT_PROPS} />);
    const filterBtn = () =>
      screen.queryByTitle('Filter groups') ?? screen.getByTitle(/groups filtered/i);
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
    render(<MetricsView {...DEFAULT_PROPS} />);
    const filterBtn = () =>
      screen.queryByTitle('Filter groups') ?? screen.getByTitle(/groups filtered/i);
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

  it('filter icon title changes to "Groups filtered" when a group is hidden', () => {
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A, lm2: LM_IN_B }, { g1: GROUP_A, g2: GROUP_B });
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Filter groups'));
    const alphaBtn = screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn);
    expect(screen.getByTitle(/groups filtered/i)).toBeInTheDocument();
  });

  // ── help button ───────────────────────────────────────────────────────────

  it('renders the help button in the header', () => {
    setup();
    render(<MetricsView {...DEFAULT_PROPS} />);
    expect(screen.getByTitle('Help')).toBeInTheDocument();
  });

  it('clicking the help button opens the usage popover', async () => {
    setup();
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Help'));
    await waitFor(() =>
      expect(screen.getByText(/how to use metrics/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/quality dimensions you define/i)).toBeInTheDocument();
    expect(screen.getByText(/things being measured/i)).toBeInTheDocument();
  });

  it('persists hidden groups to localStorage', () => {
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
    setup({ m1: METRIC_AVAIL }, { lm1: LM_IN_A }, { g1: GROUP_A });
    render(<MetricsView {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByTitle('Filter groups'));
    const alphaBtn = screen.getAllByText('Alpha').find(
      (el) => el.closest('button') !== null,
    )!.closest('button')!;
    fireEvent.click(alphaBtn);
    const stored = JSON.parse(localStorage.getItem('landmarks.metrics.hiddenGroups')!);
    expect(stored).toContain('g1');
    localStorage.removeItem('landmarks.metrics.hiddenGroups');
  });
});

