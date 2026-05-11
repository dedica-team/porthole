import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { create } from 'zustand';
import EditorPanel from '../components/Sidebar/panels/EditorPanel';
import type { Terrain } from '../types/hex';
// Minimal store-mock für EditorPanel
const useMapStoreMock = create(() => ({
  editorTool: 'RAISE' as const,
  editorTerrain: 'GRASS' as Terrain,
  selectedTile: null as { q: number; r: number } | null,
  currentMap: null,
  setEditorTool: vi.fn(),
  setEditorTerrain: vi.fn(),
  setEditorMode: vi.fn(),
}));

vi.mock('../store/mapStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store/mapStore')>();
  return { ...actual };
});

describe('EditorPanel (LandscapeEditor replacement)', () => {
  it('shows all three tools', () => {
    render(<EditorPanel />);
    expect(screen.getByText('▲ Raise')).toBeInTheDocument();
    expect(screen.getByText('▼ Lower')).toBeInTheDocument();
    expect(screen.getByText('🎨 Terrain')).toBeInTheDocument();
  });

  it('terrain buttons hidden when tool is not TERRAIN', () => {
    render(<EditorPanel />);
    expect(screen.queryByText('🌿 Grass')).not.toBeInTheDocument();
  });

  it('renders a floating toolbar variant for the map overlay', () => {
    render(<EditorPanel floating />);
    expect(screen.getByRole('button', { name: '▲ Raise' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  // Additional tests use the real store
});

void useMapStoreMock;
