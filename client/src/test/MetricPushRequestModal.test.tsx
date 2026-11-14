import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetricPushRequestModal from '@/components/MetricsView/MetricPushRequestModal';
import { useMapStore, useAuthStore } from '@/store/mapStore';
import * as mapApi from '@/api/mapApi';
import type { QualityMetric, Landmark } from '@/types/landmark';

vi.mock('@/api/mapApi', () => ({
  pushMetricValues: vi.fn(),
  saveMetricPreset: vi.fn(),
  deleteMetricPreset: vi.fn(),
}));

const mockMetric: QualityMetric = {
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

const mockLandmarks: Record<string, Landmark> = {
  lm1: {
    id: 'lm1',
    name: 'Auth Service',
    type: 'KEEP',
    ownerId: 'p1',
    links: { repository: 'https://gitlab.example.com/team/auth-service.git' },
  },
};

describe('MetricPushRequestModal', () => {
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
      metrics: { 'm-123': mockMetric },
    });
  });

  it('renders modal with metric information and direct JSON tab', () => {
    render(<MetricPushRequestModal metric={mockMetric} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/REST API Push Values: Code Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/POST \/api\/sessions\/sess-abc\/metrics\/m-123\/values/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Push Metric Values/i })).toBeInTheDocument();
  });

  it('submits direct JSON batch push to API', async () => {
    const pushMock = vi.mocked(mapApi.pushMetricValues).mockResolvedValue({
      updatedCount: 1,
      unmatchedElements: [],
      warnings: [],
    });

    render(<MetricPushRequestModal metric={mockMetric} open={true} onOpenChange={vi.fn()} />);

    const pushBtn = screen.getByRole('button', { name: /Push Metric Values/i });
    fireEvent.click(pushBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('sess-abc', 'm-123', expect.objectContaining({
        matchBy: 'NAME',
      }));
    });

    expect(screen.getByText(/Batch push completed successfully! Updated 1 landmark/i)).toBeInTheDocument();
  });

  it('switches to JQ transformation builder and runs dry-run preview', async () => {
    render(<MetricPushRequestModal metric={mockMetric} open={true} onOpenChange={vi.fn()} />);

    const jqTab = screen.getByRole('tab', { name: /JQ Transformation Builder/i });
    fireEvent.click(jqTab);

    expect(screen.getByPlaceholderText('Preset Name')).toHaveValue('GitLab CI Coverage');

    const dryRunBtn = screen.getByRole('button', { name: /Execute JQ Dry-Run/i });
    fireEvent.click(dryRunBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 Matched/i)).toBeInTheDocument();
    });
  });
});
