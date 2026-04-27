import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetricTemplateSelector from '../components/MetricsView/MetricTemplateSelector';
import * as mapApi from '../api/mapApi';
import type { MetricTemplate } from '../types/map';

const TEMPLATES: MetricTemplate[] = [
  { id: 'codebase',     name: 'Codebase',     description: 'One codebase, many deploys.' },
  { id: 'config',       name: 'Config',       description: 'Store config in the environment.' },
  { id: 'logs',         name: 'Logs',         description: 'Treat logs as event streams.' },
];

describe('MetricTemplateSelector', () => {
  const onSubmit = vi.fn();
  const onClose  = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockResolvedValue(TEMPLATES);
  });

  afterEach(() => vi.restoreAllMocks());

  // ── not rendered when closed ───────────────────────────────────────────────

  it('renders nothing when open=false', () => {
    render(<MetricTemplateSelector open={false} onSubmit={onSubmit} onClose={onClose} />);
    expect(screen.queryByText('Add Metric')).not.toBeInTheDocument();
  });

  // ── loading state ─────────────────────────────────────────────────────────

  it('shows a loading spinner while fetching', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockReturnValue(new Promise(() => {}));
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
  });

  // ── template list ─────────────────────────────────────────────────────────

  it('renders all templates after loading', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Codebase')).toBeInTheDocument());
    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('renders descriptions', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() =>
      expect(screen.getByText('One codebase, many deploys.')).toBeInTheDocument(),
    );
  });

  // ── search filtering ──────────────────────────────────────────────────────

  it('filters templates by name', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/search templates/i), { target: { value: 'log' } });
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.queryByText('Codebase')).not.toBeInTheDocument();
    expect(screen.queryByText('Config')).not.toBeInTheDocument();
  });

  it('filters templates by description (case-insensitive)', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/search templates/i), { target: { value: 'event streams' } });
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.queryByText('Codebase')).not.toBeInTheDocument();
  });

  it('shows "No templates match" when filter has no results', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/search templates/i), { target: { value: 'zzznomatch' } });
    expect(screen.getByText(/no templates match/i)).toBeInTheDocument();
  });

  // ── template pre-fills form ───────────────────────────────────────────────

  it('clicking a template pre-fills name and description in the form', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Codebase');
    const descInput = screen.getByPlaceholderText(/description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe('One codebase, many deploys.');
  });

  it('user can edit pre-filled fields before submitting', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    const nameInput = screen.getByPlaceholderText(/name.*availability/i);
    fireEvent.change(nameInput, { target: { value: 'My Custom Name' } });
    fireEvent.submit(nameInput.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('My Custom Name', 'One codebase, many deploys.');
  });

  // ── manual entry ──────────────────────────────────────────────────────────

  it('form is always visible (empty by default)', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    expect(screen.getByPlaceholderText(/name.*availability/i)).toBeInTheDocument();
  });

  it('submit button is disabled when name is empty', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    const submitBtn = screen.getByRole('button', { name: /add metric/i });
    expect(submitBtn).toBeDisabled();
  });

  it('submitting with a manually entered name calls onSubmit', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.change(screen.getByPlaceholderText(/name.*availability/i), { target: { value: 'SLA' } });
    fireEvent.submit(screen.getByPlaceholderText(/name.*availability/i).closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('SLA', '');
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  it('cancel (X) button calls onClose', async () => {
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    const form = screen.getByPlaceholderText(/name.*availability/i).closest('form')!;
    fireEvent.click(form.querySelector('button[type="button"]') as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  // ── error state ───────────────────────────────────────────────────────────

  it('shows an error message when fetch fails', async () => {
    vi.spyOn(mapApi, 'fetchMetricTemplates').mockRejectedValue(new Error('Network error'));
    render(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  // ── reset on close/reopen ─────────────────────────────────────────────────

  it('clears form and search when dialog is closed and reopened', async () => {
    const { rerender } = render(
      <MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />,
    );
    await waitFor(() => screen.getByText('Codebase'));
    fireEvent.click(screen.getByText('Codebase'));
    expect((screen.getByPlaceholderText(/name.*availability/i) as HTMLInputElement).value).toBe('Codebase');

    rerender(<MetricTemplateSelector open={false} onSubmit={onSubmit} onClose={onClose} />);
    rerender(<MetricTemplateSelector open={true} onSubmit={onSubmit} onClose={onClose} />);
    await waitFor(() => screen.getByText('Codebase'));
    expect((screen.getByPlaceholderText(/name.*availability/i) as HTMLInputElement).value).toBe('');
  });
});

