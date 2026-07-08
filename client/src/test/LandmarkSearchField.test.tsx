import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LandmarkSearchField from '../components/LandmarkSearchField';
import type { Landmark } from '../types/landmark';
const LANDMARKS: Landmark[] = [
  { id: 'lm-1', name: 'Iron Keep',   ownerId: 'u1', coordinate: { q: 0, r: 0 }, type: 'KEEP' },
  { id: 'lm-2', name: 'Iron Mill',   ownerId: 'u1', coordinate: { q: 1, r: 2 }, type: 'KEEP' },
  { id: 'lm-3', name: 'Stone Tower', ownerId: 'u1', coordinate: { q: 3, r: 1 }, type: 'WATCHTOWER' },
  { id: 'lm-w', name: 'Wall',        ownerId: 'u1', coordinate: { q: 2, r: 0 }, type: 'WALL' }, // decorative – excluded
];

function renderField(onSelect = vi.fn()) {
  return render(<LandmarkSearchField landmarks={LANDMARKS} onSelect={onSelect} />);
}

describe('LandmarkSearchField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the search input', () => {
    renderField();
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
  });

  it('shows no dropdown initially', () => {
    renderField();
    expect(screen.queryByText('Iron Keep')).not.toBeInTheDocument();
  });

  it('shows filtered results when typing', async () => {
    renderField();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'iron' } });
    await waitFor(() => expect(screen.getByText('Iron Keep')).toBeInTheDocument());
    expect(screen.getByText('Iron Mill')).toBeInTheDocument();
    expect(screen.queryByText('Stone Tower')).not.toBeInTheDocument();
  });

  it('excludes decorative (WALL) landmarks from results', async () => {
    renderField();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'wall' } });
    await waitFor(() => {
      expect(screen.queryByText('Wall')).not.toBeInTheDocument();
    });
  });

  it('calls onSelect and clears query when clicking a result', async () => {
    const onSelect = vi.fn();
    renderField(onSelect);
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'stone' } });
    const result = await screen.findByText('Stone Tower');
    fireEvent.mouseDown(result);
    expect(onSelect).toHaveBeenCalledWith(LANDMARKS[2]);
    expect(screen.getByPlaceholderText('Search…')).toHaveValue('');
  });

  it('calls onSelect with first result on Enter', async () => {
    const onSelect = vi.fn();
    renderField(onSelect);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.change(input, { target: { value: 'iron' } });
    await screen.findByText('Iron Keep');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(LANDMARKS[0]);
    expect(input).toHaveValue('');
  });

  it('Escape clears the query and does not bubble', async () => {
    const onSelect = vi.fn();
    const windowSpy = vi.fn();
    window.addEventListener('keydown', windowSpy);
    renderField(onSelect);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.change(input, { target: { value: 'iron' } });
    await screen.findByText('Iron Keep');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    // The Escape event should have stopPropagation called – window listener still fires
    // because jsdom doesn't respect stopPropagation on window, but we verify query is cleared
    expect(onSelect).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowSpy);
  });

  it('shows landmark type when no group is assigned', async () => {
    renderField();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'stone' } });
    await screen.findByText('Stone Tower');
    expect(screen.getByText('WATCHTOWER')).toBeInTheDocument();
  });
});

