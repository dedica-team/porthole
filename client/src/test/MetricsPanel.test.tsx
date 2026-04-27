import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetricsPanel from '../components/Sidebar/panels/MetricsPanel';
import { useMapStore, useAuthStore } from '../store/mapStore';
import * as mapApi from '../api/mapApi';
import type { MetricTemplate } from '../types/map';

const TEMPLATES: MetricTemplate[] = [
  { id: 'codebase', name: 'Codebase', description: 'One codebase, many deploys.' },
  { id: 'config',   name: 'Config',   description: 'Store config in the environment.' },
];

const MAP_BASE = {
  id: 'map-1', createdAt: '', collaborators: [{ id: 'p1', username: 'alice' }],
  connections: {}, map: { tiles: [] }, landmarks: {}, groups: {},
};

const MAP_BASE_VIEWER = {
  ...MAP_BASE,
  collaborators: [], // viewer is not in the collaborators list
};

function setup(metrics: Record<string, { id: string; name: string; description: string }> = {}) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({ currentMap: { ...MAP_BASE, metrics } });
}

function setupAsViewer(metrics: Record<string, { id: string; name: string; description: string }> = {}) {
  useAuthStore.setState({ userId: 'viewer', username: 'viewer', token: 'tok', isAuthenticated: true });
  useMapStore.setState({ currentMap: { ...MAP_BASE_VIEWER, metrics } });
}

describe('MetricsPanel', () => {
  const onCreateMetric = vi.fn();
  const onEditMetric   = vi.fn();
  const onRemoveMetric = vi.fn();
  const defaultProps   = { onCreateMetric, onEditMetric, onRemoveMetric, loading: false };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue(TEMPLATES);
  });
  afterEach(() => vi.restoreAllMocks());

  // ── initial state ─────────────────────────────────────────────────────────

  it('renders the "Add Metric" button initially', () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /add metric/i })).toBeInTheDocument();
  });

  // ── dialog opens ─────────────────────────────────────────────────────────

  it('clicking "Add Metric" opens the template selector dialog', async () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    // Dialog title (distinct from the button – appears as a heading)
    await waitFor(() => expect(screen.getAllByText(/add metric/i).length).toBeGreaterThan(1));
  });

  it('dialog shows template list', async () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    await waitFor(() => expect(screen.getByText('Codebase')).toBeInTheDocument());
  });

  // ── template pre-fills form ───────────────────────────────────────────────

  it('selecting a template pre-fills the form fields', async () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Codebase');
  });

  it('submitting pre-filled form calls onCreateMetric and closes dialog', async () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    fireEvent.submit(screen.getByPlaceholderText(/name.*availability/i).closest('form')!);
    expect(onCreateMetric).toHaveBeenCalledWith('Codebase', 'One codebase, many deploys.');
  });

  // ── manual entry ──────────────────────────────────────────────────────────

  it('manual form submit calls onCreateMetric with entered values', async () => {
    setup();
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /add metric/i }));
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/name.*availability/i), { target: { value: 'Custom Metric' } });
    fireEvent.submit(screen.getByPlaceholderText(/name.*availability/i).closest('form')!);
    expect(onCreateMetric).toHaveBeenCalledWith('Custom Metric', '');
  });

  // ── existing metrics list ─────────────────────────────────────────────────

  it('displays existing metrics', () => {
    setup({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Uptime %')).toBeInTheDocument();
  });

  it('edit button shows inline edit form', () => {
    setup({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit metric'));
    expect(screen.getByPlaceholderText('Metric name')).toBeInTheDocument();
  });

  it('saving edit calls onEditMetric', () => {
    setup({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Edit metric'));
    fireEvent.change(screen.getByPlaceholderText('Metric name'), { target: { value: 'Uptime' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onEditMetric).toHaveBeenCalledWith('m1', 'Uptime', 'Uptime %');
  });

  it('remove button shows confirm dialog', () => {
    setup({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Remove metric'));
    expect(screen.getByText(/remove.*availability/i)).toBeInTheDocument();
  });

  it('confirming remove calls onRemoveMetric', () => {
    setup({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Remove metric'));
    fireEvent.click(screen.getByRole('button', { name: /yes.*remove/i }));
    expect(onRemoveMetric).toHaveBeenCalledWith('m1');
  });
});

// ── non-collaborator / viewer ─────────────────────────────────────────────────

describe('MetricsPanel – non-collaborator (viewer)', () => {
  const defaultProps = {
    onCreateMetric: vi.fn(),
    onEditMetric: vi.fn(),
    onRemoveMetric: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue(TEMPLATES);
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not show the "Add Metric" button', () => {
    setupAsViewer();
    render(<MetricsPanel {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /add metric/i })).not.toBeInTheDocument();
  });

  it('displays existing metric names (read-only)', () => {
    setupAsViewer({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
  });

  it('does not show Edit or Delete buttons for existing metrics', () => {
    setupAsViewer({ m1: { id: 'm1', name: 'Availability', description: 'Uptime %' } });
    render(<MetricsPanel {...defaultProps} />);
    expect(screen.queryByTitle('Edit metric')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove metric')).not.toBeInTheDocument();
  });
});

