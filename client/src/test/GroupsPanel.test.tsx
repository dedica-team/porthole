import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GroupsPanel from '../components/Sidebar/panels/GroupsPanel';
import { useMapStore, useAuthStore } from '../store/mapStore';

const MAP_BASE = {
  id: 'map-1',
  createdAt: '',
  collaborators: [{ id: 'p1', username: 'alice' }],
  landmarks: {},
  connections: {},
  map: { tiles: [] },
};

function setup(groups = {}, landmarks = {}) {
  useAuthStore.setState({ userId: 'p1', username: 'alice', token: 'tok', isAuthenticated: true });
  useMapStore.setState({
    currentMap: { ...MAP_BASE, groups, landmarks },
    mainView: 'groups',
  });
}

describe('GroupsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty state when no groups exist', () => {
    setup();
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    expect(screen.getByText(/no groups yet/i)).toBeInTheDocument();
  });

  it('renders existing groups', () => {
    setup({ 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } });
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('calls onCreateGroup when form is submitted', () => {
    setup();
    const onCreate = vi.fn();
    render(<GroupsPanel onCreateGroup={onCreate} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    fireEvent.change(screen.getByPlaceholderText('Group name'), { target: { value: 'Beta Squad' } });
    fireEvent.click(screen.getByRole('button', { name: /add group/i }));
    expect(onCreate).toHaveBeenCalledWith('Beta Squad', expect.stringMatching(/^#/), undefined, undefined);
  });

  it('Add Group button is disabled when name is empty', () => {
    setup();
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    expect(screen.getByRole('button', { name: /add group/i })).toBeDisabled();
  });

  it('clicking edit icon shows inline edit form', () => {
    setup({ 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } });
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    const editButtons = screen.getAllByRole('button');
    // pencil button is after the group label
    const pencil = editButtons.find((b) => b.querySelector('svg.lucide-pencil'));
    if (pencil) fireEvent.click(pencil);
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
  });

  it('calls onEditGroup when save is clicked in inline editor', () => {
    setup({ 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } });
    const onEdit = vi.fn();
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={onEdit} onRemoveGroup={vi.fn()} loading={false} />);
    const pencil = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-pencil'));
    if (pencil) fireEvent.click(pencil);
    const input = screen.getByDisplayValue('Alpha');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onEdit).toHaveBeenCalledWith('g1', 'Renamed', '#ff0000', undefined, false, undefined, false);
  });

  it('shows removal confirmation with warning when landmarks are assigned', () => {
    setup(
      { 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } },
      { 'lm1': { id: 'lm1', name: 'Keep', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP', groupId: 'g1' } },
    );
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    const trash = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'));
    if (trash) fireEvent.click(trash);
    expect(screen.getByText(/will lose their group/i)).toBeInTheDocument();
  });

  it('calls onRemoveGroup after confirming deletion', () => {
    setup({ 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } });
    const onRemove = vi.fn();
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={onRemove} loading={false} />);
    const trash = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-trash-2'));
    if (trash) fireEvent.click(trash);
    // confirmation dialog shown – click "Remove"
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith('g1');
  });

  it('shows landmark count badge next to group', () => {
    setup(
      { 'g1': { id: 'g1', name: 'Alpha', color: '#ff0000' } },
      { 'lm1': { id: 'lm1', name: 'Keep', ownerId: 'p1', coordinate: { q: 0, r: 0 }, type: 'KEEP', groupId: 'g1' } },
    );
    render(<GroupsPanel onCreateGroup={vi.fn()} onEditGroup={vi.fn()} onRemoveGroup={vi.fn()} loading={false} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

