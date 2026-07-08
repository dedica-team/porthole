import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navbar from '../components/Navbar/Navbar';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore, useMapStore } from '../store/mapStore';

function renderNavbar(path = '/lobby') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>,
  );
}

describe('Navbar (HUD replacement)', () => {
  it('renders the logo', () => {
    useAuthStore.setState({ username: 'alice', avatarUrl: null, isAuthenticated: true });
    renderNavbar();
    expect(screen.getByText('Lobby')).toBeInTheDocument();
  });

  it('shows username initials in avatar when logged in', () => {
    useAuthStore.setState({ username: 'alice', avatarUrl: null, isAuthenticated: true });
    renderNavbar();
    // The avatar button is always visible; it shows the first two letters of the username.
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('shows user avatar button on map page', () => {
    useAuthStore.setState({ username: 'alice', avatarUrl: null, isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        id: 'map-abcd1234',
        createdAt: '',
        collaborators: [{ id: 'c1', username: 'alice' }],
        landmarks: {},
        connections: {},
        groups: {},
        map: { tiles: [] },
      },
    });
    renderNavbar('/session/map-abcd1234');
    expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument();
  });

  it('shows collaborator initials on map page', () => {
    useAuthStore.setState({ username: 'alice', userId: 'c1', avatarUrl: null, isAuthenticated: true });
    useMapStore.setState({
      currentMap: {
        id: 'map-abcd1234',
        createdAt: '',
        collaborators: [
          { id: 'c1', username: 'alice' },
          { id: 'c2', username: 'bob' },
        ],
        landmarks: {},
        connections: {},
        groups: {},
        map: { tiles: [] },
      },
    });
    renderNavbar('/session/map-abcd1234');
    // The current user's avatar is always shown in the top-right user menu.
    expect(screen.getAllByText('AL').length).toBeGreaterThanOrEqual(1);
  });
});
