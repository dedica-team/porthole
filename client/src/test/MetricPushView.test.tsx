import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MetricPushView from '@/components/MetricsView/MetricPushView';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { QualityMetric, Landmark } from '@/types/landmark';

vi.mock('@/api/mapApi', () => ({
  pushMetricValues: vi.fn(),
  saveMetricPreset: vi.fn(),
  deleteMetricPreset: vi.fn(),
}));

const mockMetric1: QualityMetric = {
  id: 'm-123',
  name: 'Code Coverage',
  description: 'Test coverage percentage',
  presets: [
    {
      id: 'preset-1',
      name: 'GitLab CI Coverage',
      metricId: 'm-123',
      requestUrl: 'https://gitlab.example.com/api/v4/projects/123/pipelines',
      httpMethod: 'GET',
      jqFilter: '[.[] | { element: .ref, value: (.coverage | tostring), level: "OK" }]',
      matchBy: 'NAME',
      lastPayloadSample: '[{"ref": "Auth Service", "coverage": 88}]',
    },
  ],
};

const mockMetric2: QualityMetric = {
  id: 'm-456',
  name: 'Security Vulnerabilities',
  description: 'Known CVE vulnerabilities',
};

const mockLandmarks: Record<string, Landmark> = {
  lm1: {
    id: 'lm1',
    name: 'Auth Service',
    type: 'KEEP',
    ownerId: 'p1',
    links: { repository: 'https://gitlab.example.com/team/auth-service.git' },
  },
  lm2: {
    id: 'lm2',
    name: 'prod-web-server-01',
    type: 'KEEP',
    ownerId: 'p1',
  },
};

describe('MetricPushView (Subpage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'mock-token', isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        id: 'sess-abc',
        createdAt: '',
        collaborators: [{ id: 'p1', username: 'alice' }],
        connections: {},
        landmarks: mockLandmarks,
        groups: {},
        map: { tiles: [] },
      },
      metrics: {
        'm-123': mockMetric1,
        'm-456': mockMetric2,
      },
    });
  });

  it('renders subpage header with back button and active metric details', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Back to Metrics/i })).toHaveAttribute('href', '/session/sess-abc/metrics');
    expect(screen.getByText(/REST API Push Values: Code Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Test coverage percentage/i)).toBeInTheDocument();
    expect(screen.getByText(/POST \/api\/sessions\/sess-abc\/metrics\/m-123\/values/i)).toBeInTheDocument();
  });

  it('allows switching metrics via dropdown', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const selector = screen.getByLabelText(/Select Metric/i);
    expect(selector).toHaveValue('m-123');

    fireEvent.change(selector, { target: { value: 'm-456' } });
    expect(selector).toBeInTheDocument();
  });

  it('renders JQ Transformation Builder by default and toggles Direct JSON Push view', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // JQ Transformation Builder is visible by default
    expect(screen.getByLabelText(/JQ Match Strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/JQ Filter Expression:/i)).toBeInTheDocument();

    // Button to switch to Direct JSON Push
    const directBtn = screen.getByRole('button', { name: /Direct JSON Push/i });
    expect(directBtn).toBeInTheDocument();

    // Click to display Direct JSON Push view
    fireEvent.click(directBtn);
    expect(screen.getByLabelText(/Direct Match Strategy/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste JSON payload here.../i)).toBeInTheDocument();

    // Click back to JQ transformation builder
    const backBtn = screen.getByRole('button', { name: /Back to JQ Transformation Builder/i });
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);

    expect(screen.getByLabelText(/JQ Match Strategy/i)).toBeInTheDocument();
  });

  it('supports selecting ALIAS match strategy in JQ Builder and Direct JSON views', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // JQ builder is default
    const jqMatchSelect = screen.getByLabelText(/JQ Match Strategy/i);
    expect(jqMatchSelect).toBeInTheDocument();
    fireEvent.change(jqMatchSelect, { target: { value: 'ALIAS' } });
    expect(jqMatchSelect).toHaveValue('ALIAS');

    // Toggle to Direct JSON Push
    const directToggleBtn = screen.getByRole('button', { name: /Direct JSON Push/i });
    fireEvent.click(directToggleBtn);

    const directMatchSelect = screen.getByLabelText(/Direct Match Strategy/i);
    expect(directMatchSelect).toBeInTheDocument();
    fireEvent.change(directMatchSelect, { target: { value: 'ALIAS' } });
    expect(directMatchSelect).toHaveValue('ALIAS');
  });

  it('renders empty state when no metrics exist', () => {
    useMapStore.setState({
      metrics: {},
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/push']}>
        <Routes>
          <Route path="/session/:id/metrics/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/No Metric Selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to Metrics Overview/i })).toBeInTheDocument();
  });

  it('shows loaded from persistence badge when preset matches saved data', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial load selects preset-1 (JQ builder default)
    expect(screen.getByTestId('preset-status-saved')).toHaveTextContent(/No changes/i);

    // Editing preset name or URL changes status to "Unsaved changes"
    const nameInput = screen.getByPlaceholderText('Preset Name');
    fireEvent.change(nameInput, { target: { value: 'Modified GitLab CI' } });

    expect(screen.getByTestId('preset-status-dirty')).toHaveTextContent(/Unsaved changes/i);
  });

  it('shows unsaved preset badge when creating new preset or choosing template', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const presetSelect = screen.getByLabelText(/^Preset$/i);
    fireEvent.change(presetSelect, { target: { value: '' } });

    expect(screen.getByTestId('preset-status-unsaved')).toHaveTextContent(/Unsaved preset/i);
  });

  it('validates unique preset names only for new presets and not existing ones', () => {
    // Metric with 2 presets
    const metricWithPresets: QualityMetric = {
      ...mockMetric1,
      presets: [
        {
          id: 'preset-1',
          name: 'GitLab CI Coverage',
          metricId: 'm-123',
          requestUrl: 'https://gitlab.example.com',
          httpMethod: 'GET',
          jqFilter: '.',
          matchBy: 'NAME',
        },
        {
          id: 'preset-2',
          name: 'GitHub Actions',
          metricId: 'm-123',
          requestUrl: 'https://github.com',
          httpMethod: 'GET',
          jqFilter: '.',
          matchBy: 'NAME',
        },
      ],
    };

    useMapStore.setState({
      metrics: {
        'm-123': metricWithPresets,
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Currently on existing preset-1: does not show "Name already in use" even if editing
    const nameInput = screen.getByPlaceholderText('Preset Name');
    expect(screen.queryByText(/Name already in use/i)).not.toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: 'github actions' } });
    expect(screen.queryByText(/Name already in use/i)).not.toBeInTheDocument();

    // Switch to new preset (no preset selected)
    const presetSelect = screen.getByLabelText(/^Preset$/i);
    fireEvent.change(presetSelect, { target: { value: '' } });

    // Typing an existing preset name for a new preset flags as duplicate
    fireEvent.change(nameInput, { target: { value: 'github actions' } });
    expect(screen.getByText(/Name already in use/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /Save Preset/i });
    expect(saveBtn).toBeDisabled();
  });

  it('provides feedback when a preset is saved successfully', async () => {
    const { saveMetricPreset } = await import('@/api/mapApi');
    vi.mocked(saveMetricPreset).mockResolvedValueOnce({
      id: 'sess-abc',
      createdAt: '',
      collaborators: [],
      connections: {},
      landmarks: {},
      groups: {},
      map: { tiles: [] },
      metrics: {
        'm-123': {
          ...mockMetric1,
          presets: [
            {
              id: 'preset-saved-1',
              name: 'Brand New Preset',
              metricId: 'm-123',
              requestUrl: 'https://api.example.com/data',
              httpMethod: 'GET',
              jqFilter: '.',
              matchBy: 'NAME',
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to new preset
    const presetSelect = screen.getByLabelText(/^Preset$/i);
    fireEvent.change(presetSelect, { target: { value: '' } });

    const nameInput = screen.getByPlaceholderText('Preset Name');
    fireEvent.change(nameInput, { target: { value: 'Brand New Preset' } });

    const urlInput = screen.getByPlaceholderText(/https:\/\/gitlab.example.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } });

    const saveBtn = screen.getByRole('button', { name: /Save Preset/i });
    fireEvent.click(saveBtn);

    expect(saveMetricPreset).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
      name: 'Brand New Preset',
      requestUrl: 'https://api.example.com/data',
    }));

    const feedback = await screen.findByTestId('preset-save-feedback');
    expect(feedback).toHaveTextContent(/Preset "Brand New Preset" saved successfully/i);
  });

  it('requires confirmation before deleting a preset and supports cancelling', async () => {
    const { deleteMetricPreset } = await import('@/api/mapApi');

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial state: delete button with trash icon
    const trashBtn = screen.getByRole('button', { name: /Delete Preset/i });
    expect(trashBtn).toBeInTheDocument();

    // Clicking trash shows confirmation prompt
    fireEvent.click(trashBtn);
    expect(screen.getByText(/Delete preset\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yes, delete/i })).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    // Clicking cancel dismisses confirmation without calling deleteMetricPreset
    fireEvent.click(cancelBtn);
    expect(deleteMetricPreset).not.toHaveBeenCalled();
    expect(screen.queryByText(/Delete preset\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Preset/i })).toBeInTheDocument();

    // Clicking trash again and confirming deletes the preset
    fireEvent.click(screen.getByRole('button', { name: /Delete Preset/i }));
    const confirmDeleteBtn = screen.getByRole('button', { name: /Yes, delete/i });
    fireEvent.click(confirmDeleteBtn);

    expect(deleteMetricPreset).toHaveBeenCalledWith('sess-abc', 'm-123', 'preset-1');
  });

  it('renders a help link to the official jq documentation in JQ Transformation Builder', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const helpLink = screen.getByRole('link', { name: /jq documentation/i });
    expect(helpLink).toBeInTheDocument();
    expect(helpLink).toHaveAttribute('href', 'https://jqlang.github.io/jq/manual/');
    expect(helpLink).toHaveAttribute('target', '_blank');
    expect(helpLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
