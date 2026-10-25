import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge, StatusIndicator, qualityLevelToStatus, matrixLevelToStatus, choreStateToStatus } from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders with rounded-full, status-badge class and data-status-badge attribute', () => {
    render(<StatusBadge status="GOOD">OK</StatusBadge>);

    const badge = screen.getByText('OK');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-status-badge');
    expect(badge.className).toContain('status-badge');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('bg-success/20');
  });

  it('renders different statuses with correct styling', () => {
    const { rerender } = render(<StatusBadge status="WARNING">Warning</StatusBadge>);
    let badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-warning/20');
    expect(badge.className).toContain('text-warning');

    rerender(<StatusBadge status="BAD">Error</StatusBadge>);
    badge = screen.getByText('Error');
    expect(badge.className).toContain('bg-destructive/20');
    expect(badge.className).toContain('text-destructive');

    rerender(<StatusBadge status="ONGOING">Ongoing</StatusBadge>);
    badge = screen.getByText('Ongoing');
    expect(badge.className).toContain('bg-info/20');
    expect(badge.className).toContain('text-info');

    rerender(<StatusBadge status="NONE">None</StatusBadge>);
    badge = screen.getByText('None');
    expect(badge.className).toContain('bg-muted/80');
  });

  it('maps domain levels to badge statuses', () => {
    expect(qualityLevelToStatus.OK).toBe('GOOD');
    expect(qualityLevelToStatus.WARNING).toBe('WARNING');
    expect(qualityLevelToStatus.ERROR).toBe('BAD');
    expect(qualityLevelToStatus.NONE).toBe('NONE');

    expect(matrixLevelToStatus.HIGH).toBe('GOOD');
    expect(matrixLevelToStatus.MEDIUM).toBe('WARNING');
    expect(matrixLevelToStatus.LOW).toBe('BAD');
    expect(matrixLevelToStatus.NONE).toBe('NONE');

    expect(choreStateToStatus.DONE).toBe('GOOD');
    expect(choreStateToStatus.ONGOING).toBe('ONGOING');
    expect(choreStateToStatus.BLOCKED).toBe('BAD');
    expect(choreStateToStatus.NONE).toBe('NONE');
  });

  it('renders StatusIndicator correctly', () => {
    const { container } = render(<StatusIndicator status="GOOD" />);
    const indicator = container.querySelector('span');
    expect(indicator).toBeInTheDocument();
    expect(indicator?.className).toContain('rounded-full');
    expect(indicator?.className).toContain('bg-success');
  });
});
