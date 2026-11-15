import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MetricPushView from '@/components/MetricsView/MetricPushView';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import type { QualityMetric, Landmark } from '@/types/landmark';

vi.mock('@/api/mapApi', () => ({
  pushMetricValues: vi.fn(),
  saveMetricTransformation: vi.fn(),
  deleteMetricTransformation: vi.fn(),
}));

const mockMetric1: QualityMetric = {
  id: 'm-123',
  name: 'Code Coverage',
  description: 'Test coverage percentage',
  transformations: [
    {
      id: 'transformation-1',
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
    expect(screen.getByTitle(/Test coverage percentage/i)).toBeInTheDocument();
    expect(screen.getByText(/POST \/api\/sessions\/sess-abc\/metrics\/m-123\/values/i)).toBeInTheDocument();
  });

  it('allows switching metrics via dropdown in header', () => {
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

  it('renders JQ Transformation Builder by default and toggles Direct JSON Push view via header button', () => {
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

    // Button in top right of card header to switch to Direct JSON Push
    const directBtn = screen.getByRole('button', { name: /Direct JSON Push/i });
    expect(directBtn).toBeInTheDocument();

    // Click to display Direct JSON Push view
    fireEvent.click(directBtn);
    expect(screen.getByLabelText(/Direct Match Strategy/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Paste JSON payload here.../i)).toBeInTheDocument();

    // Header toggle now says "JQ Transformation Builder"
    const headerJqBtn = screen.getByRole('button', { name: /JQ Transformation Builder/i });
    expect(headerJqBtn).toBeInTheDocument();
    fireEvent.click(headerJqBtn);

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

  it('shows loaded from persistence badge when transformation matches saved data', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial load selects transformation-1 (JQ builder default)
    expect(screen.getByTestId('transformation-status-saved')).toHaveTextContent(/No changes/i);

    // Editing transformation name or URL changes status to "Unsaved changes"
    const nameInput = screen.getByPlaceholderText('Transformation Name');
    fireEvent.change(nameInput, { target: { value: 'Modified GitLab CI' } });

    expect(screen.getByTestId('transformation-status-dirty')).toHaveTextContent(/Unsaved changes/i);
  });

  it('shows unsaved transformation badge when creating new transformation or choosing template', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const transformationSelect = screen.getByLabelText(/^Transformation$/i);
    fireEvent.change(transformationSelect, { target: { value: '' } });

    expect(screen.getByTestId('transformation-status-unsaved')).toHaveTextContent(/Unsaved transformation/i);
  });

  it('validates unique transformation names only for new transformations and not existing ones', () => {
    // Metric with 2 transformations
    const metricWithTransformations: QualityMetric = {
      ...mockMetric1,
      transformations: [
        {
          id: 'transformation-1',
          name: 'GitLab CI Coverage',
          metricId: 'm-123',
          requestUrl: 'https://gitlab.example.com',
          httpMethod: 'GET',
          jqFilter: '.',
          matchBy: 'NAME',
        },
        {
          id: 'transformation-2',
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
        'm-123': metricWithTransformations,
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Currently on existing transformation-1: does not show "Name already in use" even if editing
    const nameInput = screen.getByPlaceholderText('Transformation Name');
    expect(screen.queryByText(/Name already in use/i)).not.toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: 'github actions' } });
    expect(screen.queryByText(/Name already in use/i)).not.toBeInTheDocument();

    // Switch to new transformation (no transformation selected)
    const transformationSelect = screen.getByLabelText(/^Transformation$/i);
    fireEvent.change(transformationSelect, { target: { value: '' } });

    // Typing an existing transformation name for a new transformation flags as duplicate
    fireEvent.change(nameInput, { target: { value: 'github actions' } });
    expect(screen.getByText(/Name already in use/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /Save Transformation/i });
    expect(saveBtn).toBeDisabled();
  });

  it('provides feedback when a transformation is saved successfully', async () => {
    const { saveMetricTransformation } = await import('@/api/mapApi');
    vi.mocked(saveMetricTransformation).mockResolvedValueOnce({
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
          transformations: [
            {
              id: 'transformation-saved-1',
              name: 'Brand New Transformation',
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

    // Switch to new transformation
    const transformationSelect = screen.getByLabelText(/^Transformation$/i);
    fireEvent.change(transformationSelect, { target: { value: '' } });

    const nameInput = screen.getByPlaceholderText('Transformation Name');
    fireEvent.change(nameInput, { target: { value: 'Brand New Transformation' } });

    const urlInput = screen.getByPlaceholderText(/https:\/\/gitlab.example.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://api.example.com/data' } });

    const saveBtn = screen.getByRole('button', { name: /Save Transformation/i });
    fireEvent.click(saveBtn);

    expect(saveMetricTransformation).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
      name: 'Brand New Transformation',
      requestUrl: 'https://api.example.com/data',
    }));

    const feedback = await screen.findByTestId('transformation-save-feedback');
    expect(feedback).toHaveTextContent(/Transformation "Brand New Transformation" saved successfully/i);
  });

  it('saves transformation with the chosen target metric when changed', async () => {
    const { saveMetricTransformation } = await import('@/api/mapApi');
    vi.mocked(saveMetricTransformation).mockResolvedValueOnce({
      id: 'sess-abc',
      createdAt: '',
      collaborators: [],
      connections: {},
      landmarks: {},
      groups: {},
      map: { tiles: [] },
      metrics: {
        'm-456': {
          ...mockMetric2,
          transformations: [
            {
              id: 'transformation-saved-2',
              name: 'Security Scanner',
              metricId: 'm-456',
              requestUrl: 'https://sec.example.com/api',
              httpMethod: 'GET',
              jqFilter: '.',
              matchBy: 'NAME',
            },
          ],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-456/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText('Transformation Name');
    fireEvent.change(nameInput, { target: { value: 'Security Scanner' } });

    const urlInput = screen.getByPlaceholderText(/https:\/\/gitlab.example.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://sec.example.com/api' } });

    const saveBtn = screen.getByRole('button', { name: /Save Transformation/i });
    fireEvent.click(saveBtn);

    // Saved to m-456 (the active metric)
    expect(saveMetricTransformation).toHaveBeenCalledWith('sess-abc', 'm-456', expect.objectContaining({
      name: 'Security Scanner',
      requestUrl: 'https://sec.example.com/api',
    }));

    const feedback = await screen.findByTestId('transformation-save-feedback');
    expect(feedback).toHaveTextContent(/Transformation "Security Scanner" saved successfully/i);
  });

  it('requires confirmation before deleting a transformation and supports cancelling', async () => {
    const { deleteMetricTransformation } = await import('@/api/mapApi');

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial state: delete button with trash icon
    const trashBtn = screen.getByRole('button', { name: /Delete Transformation/i });
    expect(trashBtn).toBeInTheDocument();

    // Clicking trash shows confirmation prompt
    fireEvent.click(trashBtn);
    expect(screen.getByText(/Delete transformation\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yes, delete/i })).toBeInTheDocument();
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    // Clicking cancel dismisses confirmation without calling deleteMetricTransformation
    fireEvent.click(cancelBtn);
    expect(deleteMetricTransformation).not.toHaveBeenCalled();
    expect(screen.queryByText(/Delete transformation\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Transformation/i })).toBeInTheDocument();

    // Clicking trash again and confirming deletes the transformation
    fireEvent.click(screen.getByRole('button', { name: /Delete Transformation/i }));
    const confirmDeleteBtn = screen.getByRole('button', { name: /Yes, delete/i });
    fireEvent.click(confirmDeleteBtn);

    expect(deleteMetricTransformation).toHaveBeenCalledWith('sess-abc', 'm-123', 'transformation-1');
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

  it('runs jq dry-run transformation successfully, shows Preview section, and supports inspecting payload', async () => {
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: writeTextMock } });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify Preview heading exists
    expect(screen.getByRole('heading', { name: /Preview/i, level: 3 })).toBeInTheDocument();

    // Click "Execute JQ Dry-Run" with existing template / payload
    const dryRunBtn = screen.getByRole('button', { name: /Execute JQ Dry-Run/i });
    fireEvent.click(dryRunBtn);

    // Should render dry-run reconciliation summary without errors
    expect(await screen.findByText(/Dry-Run Preview:/i)).toBeInTheDocument();
    expect(screen.queryByText(/JQ Transformation output must evaluate to an array/i)).not.toBeInTheDocument();

    // Inspect Payload button should appear
    const inspectPayloadBtn = screen.getByRole('button', { name: /Inspect Payload/i });
    expect(inspectPayloadBtn).toBeInTheDocument();

    // Click "Inspect Payload"
    fireEvent.click(inspectPayloadBtn);

    // Should show transformed JSON payload
    const payloadPre = screen.getByTestId('transformed-payload-preview');
    expect(payloadPre).toBeInTheDocument();
    expect(payloadPre.textContent).toContain('"element": "Auth Service"');
    expect(payloadPre.textContent).toContain('"value": "88"');

    // Click "Copy Payload"
    const copyPayloadBtn = screen.getByRole('button', { name: /Copy Payload/i });
    fireEvent.click(copyPayloadBtn);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"element": "Auth Service"'));

    // Switch back to Table Preview
    const tableBtn = screen.getByRole('button', { name: /Table Preview/i });
    fireEvent.click(tableBtn);
    expect(screen.getByText(/Dry-Run Preview:/i)).toBeInTheDocument();
  });

  it('displays error when jq dry-run output does not evaluate to an array', async () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Set filter to '.' and sample to a single object (evaluates to object, not array)
    const jqFilterInput = screen.getByDisplayValue(mockMetric1.transformations![0].jqFilter);
    fireEvent.change(jqFilterInput, { target: { value: '.' } });

    const sampleTextarea = screen.getByDisplayValue(mockMetric1.transformations![0].lastPayloadSample!);
    fireEvent.change(sampleTextarea, { target: { value: '{"key": "value"}' } });

    const dryRunBtn = screen.getByRole('button', { name: /Execute JQ Dry-Run/i });
    fireEvent.click(dryRunBtn);

    expect(await screen.findByText(/JQ Transformation output must evaluate to an array of metric elements, but got object\./i)).toBeInTheDocument();
  });
});
