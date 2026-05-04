import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';

const requestRender = vi.fn();
const setCss2dActive = vi.fn();
const scene = new THREE.Scene();

vi.mock('../components/HexGrid/useThreeScene', () => ({
  useThreeScene: () => ({
    current: {
      scene,
      camera: new THREE.PerspectiveCamera(),
      renderer: { domElement: document.createElement('canvas') },
      css2dRenderer: {},
      controls: { enabled: true },
      needsRenderRef: { current: false },
      requestRender,
      setCss2dActive,
    },
  }),
}));

import HexGrid from '../components/HexGrid/HexGrid';
import { useMapStore } from '../store/mapStore';
import type { SessionState } from '../types/session';

const mapFixture: SessionState = {
  id: 'map-1',
  createdAt: new Date().toISOString(),
  collaborators: [],
  landmarks: {},
  connections: {},
  groups: {},
  map: { tiles: [] },
};

describe('HexGrid – CSS2D metric overlay activation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useMapStore.setState({ selectedTile: null, currentMap: mapFixture });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activates CSS2D rendering when metric overlay entries are present and deactivates it when removed', () => {
    const { rerender } = render(
      <HexGrid
        map={mapFixture}
        onTileClick={() => {}}
        hideDecorations
        metricOverlayEntries={new Map([['metric-1', { value: '42', color: '#38bdf8' }]])}
      />,
    );

    expect(setCss2dActive).toHaveBeenCalledWith(true);

    rerender(
      <HexGrid
        map={mapFixture}
        onTileClick={() => {}}
        hideDecorations
        metricOverlayEntries={undefined}
      />,
    );

    expect(setCss2dActive).toHaveBeenLastCalledWith(false);
  });

  it('keeps CSS2D rendering disabled when overlay entries are absent or empty', () => {
    render(
      <HexGrid
        map={mapFixture}
        onTileClick={() => {}}
        hideDecorations
        metricOverlayEntries={new Map()}
      />,
    );

    expect(setCss2dActive).toHaveBeenCalledWith(false);
  });
});

