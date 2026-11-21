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
  generatePushToken: vi.fn(),
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
    expect(screen.getByText(/Transformation for Code Coverage/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Test coverage percentage/i)).toBeInTheDocument();
    expect(screen.getByText(/POST \/api\/sessions\/sess-abc\/metrics\/m-123\/values/i)).toBeInTheDocument();
  });

  it('allows switching metrics via select dropdown in transformation section without reloading', () => {
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
    expect(selector).toHaveValue('m-456');
    expect(screen.getByText(/Transformation for Security Vulnerabilities/i)).toBeInTheDocument();
  });

  it('opens modal on Open Transformation button click and lists saved transformations plus new option', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i });
    expect(loadBtn).toBeInTheDocument();

    fireEvent.click(loadBtn);

    expect(screen.getByRole('heading', { name: /Load Transformation/i })).toBeInTheDocument();
    expect(screen.getByText(/-- New \/ Custom Transformation --/i)).toBeInTheDocument();
    expect(screen.getByText('GitLab CI Coverage')).toBeInTheDocument();

    // Selecting a transformation loads it and closes modal
    fireEvent.click(screen.getByText('GitLab CI Coverage'));
    expect(screen.queryByRole('heading', { name: /Load Transformation/i })).not.toBeInTheDocument();
  });

  it('opens Help modal on Help button click and displays explanations', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const helpBtn = screen.getByRole('button', { name: 'Help' });
    expect(helpBtn).toBeInTheDocument();

    fireEvent.click(helpBtn);

    expect(screen.getByRole('heading', { name: /Transformation & Ingestion Guide/i })).toBeInTheDocument();
    expect(screen.getByText(/Overview & Data Flow/i)).toBeInTheDocument();
    expect(screen.getByText(/Parameters & Placeholders/i)).toBeInTheDocument();
    expect(screen.getByText(/JQ Filter & Payload Schema/i)).toBeInTheDocument();
    expect(screen.getByText(/Automated CI\/CD Pushes/i)).toBeInTheDocument();

    // Close button dismisses modal
    const closeBtns = screen.getAllByRole('button', { name: /Close/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole('heading', { name: /Transformation & Ingestion Guide/i })).not.toBeInTheDocument();
  });

  it('renders JQ Transformation Builder view by default and displays Transformed Data field in Preview section', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Transformation Builder is visible by default
    expect(screen.getByLabelText(/JQ Match Strategy/i)).toBeInTheDocument();
    expect(screen.getByText(/JQ Filter Expression:/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transformed Data/i)).toBeInTheDocument();

    // Direct JSON Push tab toggle button is removed
    expect(screen.queryByRole('button', { name: /Direct JSON Push/i })).not.toBeInTheDocument();
  });

  it('supports selecting ALIAS match strategy in Transformation view', () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const jqMatchSelect = screen.getByLabelText(/JQ Match Strategy/i);
    expect(jqMatchSelect).toBeInTheDocument();
    fireEvent.change(jqMatchSelect, { target: { value: 'ALIAS' } });
    expect(jqMatchSelect).toHaveValue('ALIAS');
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

    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

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

    // Switch to new transformation via Load Transformation modal
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

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

    // Switch to new transformation via modal
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

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

    // Verify Transformation heading exists
    expect(screen.getByRole('heading', { name: 'Transformation', level: 3 })).toBeInTheDocument();

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

    // Should show transformed JSON payload in transformed data textarea
    const payloadTextarea = screen.getByTestId('transformed-payload-preview') as HTMLTextAreaElement;
    expect(payloadTextarea).toBeInTheDocument();
    expect(payloadTextarea.value).toContain('"element": "Auth Service"');
    expect(payloadTextarea.value).toContain('"value": "88"');

    // Click "Copy Payload"
    const copyPayloadBtn = screen.getByRole('button', { name: /Copy Payload/i });
    fireEvent.click(copyPayloadBtn);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('"element": "Auth Service"'));

    // Switch back to Table Preview
    const tableBtn = screen.getByRole('button', { name: /Table Preview/i });
    fireEvent.click(tableBtn);
    expect(screen.getByText(/Dry-Run Preview:/i)).toBeInTheDocument();
  });

  it('supports directly editing transformed data field for dry-run preview and push execution', async () => {
    const { pushMetricValues } = await import('@/api/mapApi');
    vi.mocked(pushMetricValues).mockResolvedValueOnce({
      updatedCount: 2,
      unmatchedElements: [],
      warnings: [],
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Transformed data textarea is present in Preview section
    const transformedDataTextarea = screen.getByLabelText(/Transformed Data/i);
    expect(transformedDataTextarea).toBeInTheDocument();

    // Directly paste or edit transformed JSON
    const customPayload = JSON.stringify([
      { element: 'Auth Service', value: '99', level: 'OK' },
      { element: 'prod-web-server-01', value: '42', level: 'WARNING' },
    ], null, 2);

    fireEvent.change(transformedDataTextarea, { target: { value: customPayload } });

    // Dry-run preview immediately reconciles and renders
    expect(screen.getByText(/Dry-Run Preview:/i)).toBeInTheDocument();
    expect(screen.getByText(/2 Matched/i)).toBeInTheDocument();

    // Push Transformed Values button pushes the edited transformed data
    const pushBtn = screen.getByRole('button', { name: /Push Transformed Values/i });
    fireEvent.click(pushBtn);

    expect(pushMetricValues).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
      matchBy: 'NAME',
      values: [
        { element: 'Auth Service', value: '99', level: 'OK' },
        { element: 'prod-web-server-01', value: '42', level: 'WARNING' },
      ],
    }));

    expect(await screen.findByText(/Batch push completed successfully! Updated 2 element\(s\)\./i)).toBeInTheDocument();
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

  it('supports editing parameters and request body and saving them with transformation', async () => {
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
              id: 'transformation-saved-graphql',
              name: 'GraphQL MRs Ingestion',
              metricId: 'm-123',
              requestUrl: 'https://gitlab.example.com/api/graphql',
              httpMethod: 'POST',
              parameters: { group_path: 'my-group' },
              requestBody: '{"query": "query { group { id } }"}',
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
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

    const nameInput = screen.getByPlaceholderText('Transformation Name');
    fireEvent.change(nameInput, { target: { value: 'GraphQL MRs Ingestion' } });

    const urlInput = screen.getByPlaceholderText(/https:\/\/gitlab.example.com/i);
    fireEvent.change(urlInput, { target: { value: 'https://gitlab.example.com/api/graphql' } });

    const methodSelect = screen.getByDisplayValue('GET');
    fireEvent.change(methodSelect, { target: { value: 'POST' } });

    // Add a parameter row
    const addParamBtn = screen.getByRole('button', { name: /Add Parameter/i });
    fireEvent.click(addParamBtn);

    const paramKeyInput = screen.getByPlaceholderText('Key (e.g. group_path)');
    fireEvent.change(paramKeyInput, { target: { value: 'group_path' } });

    const paramValInput = screen.getByPlaceholderText('Value');
    fireEvent.change(paramValInput, { target: { value: 'my-group' } });

    const authHeaderInput = screen.getByLabelText('Auth Header');
    fireEvent.change(authHeaderInput, { target: { value: 'PRIVATE-TOKEN: secret-token-xyz' } });

    const requestBodyInput = screen.getByLabelText('Request Body');
    fireEvent.change(requestBodyInput, { target: { value: '{"query": "query { group { id } }"}' } });

    const saveBtn = screen.getByRole('button', { name: /Save Transformation/i });
    fireEvent.click(saveBtn);

    expect(saveMetricTransformation).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
      name: 'GraphQL MRs Ingestion',
      requestUrl: 'https://gitlab.example.com/api/graphql',
      httpMethod: 'POST',
      parameters: { group_path: 'my-group' },
      authHeader: 'PRIVATE-TOKEN: secret-token-xyz',
      requestBody: '{"query": "query { group { id } }"}',
    }));
  });

  it('shows Load Template dropdown only for unsaved transformations', async () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial render has saved transformation selected -> Load Template should NOT be visible
    expect(screen.queryByLabelText(/Transformation Template/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Load Template:/i)).not.toBeInTheDocument();

    // Switch to New / Custom Transformation via Load Transformation modal
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

    // Unsaved transformation -> Load Template should be visible
    expect(screen.getByLabelText(/Transformation Template/i)).toBeInTheDocument();
    expect(screen.getByText(/Load Template:/i)).toBeInTheDocument();

    // Loading a saved transformation hides it again
    fireEvent.click(loadBtn);
    fireEvent.click(screen.getByText('GitLab CI Coverage'));
    expect(screen.queryByLabelText(/Transformation Template/i)).not.toBeInTheDocument();
  });

  it('populates parameters and request body when a built-in template is selected for unsaved transformation', async () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to new transformation
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

    const templateSelect = screen.getByLabelText(/Transformation Template/i);
    fireEvent.change(templateSelect, { target: { value: 'gitlab-open-pull-requests' } });

    const paramsInput = screen.getByLabelText('group_id') as HTMLInputElement;
    expect(paramsInput.value).toBe('1234');

    const perPageInput = screen.getByLabelText('per_page') as HTMLInputElement;
    expect(perPageInput.value).toBe('100');

    const authHeaderInput = screen.getByLabelText('Auth Header') as HTMLInputElement;
    expect(authHeaderInput.value).toBe('PRIVATE-TOKEN: $PRIVATE_TOKEN');

    const requestBodyInput = screen.getByLabelText('Request Body') as HTMLTextAreaElement;
    expect(requestBodyInput.value).toBe('');
  });

  it('copies foreign curl request with inserted parameters and auth headers when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
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
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

    const templateSelect = screen.getByLabelText(/Transformation Template/i);
    fireEvent.change(templateSelect, { target: { value: 'gitlab-open-pull-requests' } });

    const paramsInput = screen.getByLabelText('group_id');
    fireEvent.change(paramsInput, { target: { value: '9999' } });

    const copyCurlBtn = screen.getByRole('button', { name: /Copy curl Request/i });
    fireEvent.click(copyCurlBtn);

    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('while :; do'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('https://gitlab.example.com/api/v4/groups/9999/merge_requests?state=opened&include_subgroups=true&per_page=100&page=$page'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('-H "PRIVATE-TOKEN: $PRIVATE_TOKEN"'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('| jq \'group_by(.project_id)'),
    );
  });

  it('supports adding and removing parameter fields in key value map', async () => {
    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    // Switch to new transformation
    const loadBtn = screen.getByRole('button', { name: /Open Transformation/i  });
    fireEvent.click(loadBtn);
    const newOption = screen.getByText(/-- New \/ Custom Transformation --/i);
    fireEvent.click(newOption);

    const templateSelect = screen.getByLabelText(/Transformation Template/i);
    fireEvent.change(templateSelect, { target: { value: 'github-pull-requests' } });

    // GitHub template has 3 parameters: owner, repo, state
    expect(screen.getByLabelText('owner')).toHaveValue('owner');
    expect(screen.getByLabelText('repo')).toHaveValue('repo');
    expect(screen.getByLabelText('state')).toHaveValue('open');

    // Remove state parameter
    const removeStateBtn = screen.getByLabelText('Remove Parameter state');
    fireEvent.click(removeStateBtn);
    expect(screen.queryByLabelText('state')).not.toBeInTheDocument();

    // Add another parameter
    const addParamBtn = screen.getByRole('button', { name: /Add Parameter/i });
    fireEvent.click(addParamBtn);

    const keyInputs = screen.getAllByPlaceholderText('Key (e.g. group_path)');
    const lastKeyInput = keyInputs[keyInputs.length - 1];
    fireEvent.change(lastKeyInput, { target: { value: 'per_page' } });

    const perPageValInput = screen.getByLabelText('per_page');
    fireEvent.change(perPageValInput, { target: { value: '50' } });
    expect(perPageValInput).toHaveValue('50');
  });

  it('updates existing transformation with auth header and clears unsaved changes badge after clicking update', async () => {
    const { saveMetricTransformation } = await import('@/api/mapApi');
    const existingTrans = mockMetric1.transformations![0];

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
              ...existingTrans,
              authHeader: 'PRIVATE-TOKEN: updated-secret-token',
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

    // Initially saved transformation is clean
    expect(screen.getByTestId('transformation-status-saved')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-status-dirty')).not.toBeInTheDocument();

    // Modify Auth Header
    const authHeaderInput = screen.getByLabelText('Auth Header');
    fireEvent.change(authHeaderInput, { target: { value: 'PRIVATE-TOKEN: updated-secret-token' } });

    // Status changes to Unsaved changes
    expect(screen.getByTestId('transformation-status-dirty')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-status-saved')).not.toBeInTheDocument();

    const updateBtn = screen.getByRole('button', { name: /Update Transformation/i });
    fireEvent.click(updateBtn);

    expect(saveMetricTransformation).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
      id: existingTrans.id,
      authHeader: 'PRIVATE-TOKEN: updated-secret-token',
    }));

    // After successful update, status badge returns to Saved and unsaved changes badge is removed
    expect(await screen.findByTestId('transformation-status-saved')).toBeInTheDocument();
    expect(screen.queryByTestId('transformation-status-dirty')).not.toBeInTheDocument();
  });

  it('generates and copies scoped push token shell command on button click', async () => {
    const { generatePushToken } = await import('@/api/mapApi');
    vi.mocked(generatePushToken).mockResolvedValueOnce({
      token: 'mock-scoped-push-jwt-xyz',
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const generateBtn = screen.getByTestId('generate-push-token-btn');
    fireEvent.click(generateBtn);

    expect(generatePushToken).toHaveBeenCalledWith('sess-abc', 'm-123');
    expect(await screen.findByDisplayValue('PORTHOLE_TOKEN=mock-scoped-push-jwt-xyz')).toBeInTheDocument();
    expect(writeTextMock).toHaveBeenCalledWith('PORTHOLE_TOKEN=mock-scoped-push-jwt-xyz');
  });

  it('generates and copies CI automation script with $PORTHOLE_TOKEN placeholder', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter initialEntries={['/session/sess-abc/metrics/m-123/push']}>
        <Routes>
          <Route path="/session/:id/metrics/:metricId/push" element={<MetricPushView />} />
        </Routes>
      </MemoryRouter>
    );

    const copyCiBtn = screen.getByTestId('copy-ci-script-btn');
    fireEvent.click(copyCiBtn);

    expect(await screen.findByText('Copied CI Script')).toBeInTheDocument();
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('Bearer $PORTHOLE_TOKEN'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('X-Requested-With: XMLHttpRequest'),
    );
    expect(writeTextMock).toHaveBeenCalledWith(
      expect.stringContaining('/metrics/m-123/values'),
    );
  });
});
