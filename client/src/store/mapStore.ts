import { create } from 'zustand';
import type { SessionState } from '../types/session';
import type { HexTile, Terrain } from '../types/hex';
import type { Landmark } from '../types/landmark';
import type { ConnectionType } from '../types/connection';
import type { Process } from '../types/process';
import type { ChoreList } from '../types/chores';
import type { CollaboratorMatrix } from '../types/matrix';
import type { QualityMetric } from '../types/landmark';
import {
  DEFAULT_RENDERER_QUALITY_PROFILE,
  RENDERER_QUALITY_STORAGE_KEY,
  readRendererQualityOverride,
  type RendererQualityProfile,
} from '../components/HexGrid/renderQuality';

function getInitialRendererQualityProfile(): RendererQualityProfile {
  if (typeof window === 'undefined') return DEFAULT_RENDERER_QUALITY_PROFILE;
  return readRendererQualityOverride({
    localStorageValue: window.localStorage.getItem(RENDERER_QUALITY_STORAGE_KEY),
  }) ?? DEFAULT_RENDERER_QUALITY_PROFILE;
}

interface AuthState {
  token: string | null;
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  sessionLoading: boolean;
  sessionResolved: boolean;
  tagline: string;
  setTagline: (tagline: string) => void;
  login: (userId: string, username: string, avatarUrl: string | null, isAdmin?: boolean) => void;
  logout: () => void;
  setSession: (session: { userId: string; username: string; avatarUrl: string | null; isAdmin?: boolean } | null) => void;
  setSessionLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  username: null,
  avatarUrl: null,
  isAdmin: false,
  isAuthenticated: false,
  sessionLoading: false,
  sessionResolved: false,
  tagline: 'for teams',
  setTagline: (tagline) => set({ tagline }),
  login: (userId, username, avatarUrl, isAdmin = false) => {
    set({ token: null, userId, username, avatarUrl, isAdmin, isAuthenticated: true, sessionLoading: false, sessionResolved: true });
  },
  logout: () => {
    set({ token: null, userId: null, username: null, avatarUrl: null, isAdmin: false, isAuthenticated: false, sessionLoading: false, sessionResolved: true });
  },
  setSession: (session) => set({
    token: null,
    userId: session?.userId ?? null,
    username: session?.username ?? null,
    avatarUrl: session?.avatarUrl ?? null,
    isAdmin: session?.isAdmin ?? false,
    isAuthenticated: session != null,
    sessionLoading: false,
    sessionResolved: true,
  }),
  setSessionLoading: (loading) => set({ sessionLoading: loading }),
}));

export type MainView = 'idle' | 'tile' | 'landmark' | 'editor' | 'groups' | 'metrics' | 'matrix' | 'process' | 'chores';

interface MapStore {
  maps: SessionState[];
  currentMap: SessionState | null;
  /** Optimistic tile overrides keyed by "q,r". Incoming WebSocket broadcasts
   *  are merged with these so that in-flight edits never flicker back. */
  pendingTiles: Map<string, HexTile>;
  selectedTile: { q: number; r: number } | null;
  selectedLandmark: Landmark | null;
  selectedConnectionId: string | null;
  connectingFromLandmarkId: string | null;
  relocatingLandmarkId: string | null;
  pendingConnectionMeta: { type: ConnectionType; name?: string; description?: string };
  editorMode: boolean;
  editorTool: 'RAISE' | 'LOWER' | 'TERRAIN';
  editorTerrain: Terrain;
  rendererQualityProfile: RendererQualityProfile;
  mainView: MainView;
  confirmPending: boolean;
  // ── Process mode ──────────────────────────────────────────────────────────
  processMode: boolean;
  activeProcessId: string | null;
  activeStageId: string | null;
  pickingConnection: boolean;  // crosshair pick mode within an open stage
  processes: Process[];
  processesFetched: boolean;
  processesLoading: boolean;
  processesError: string | null;
  setMaps: (maps: SessionState[]) => void;
  setCurrentMap: (map: SessionState | null) => void;
  updateMap: (map: SessionState) => void;
  updateTile: (mapId: string, tile: HexTile) => void;
  /** Remove a tile from the pending set once the server has confirmed it. */
  commitTile: (mapId: string, q: number, r: number) => void;
  /** Revert an optimistic tile update and remove it from the pending set. */
  revertTile: (mapId: string, original: HexTile) => void;
  setSelectedTile: (tile: { q: number; r: number } | null) => void;
  setSelectedLandmark: (landmark: Landmark | null) => void;
  setSelectedConnectionId: (id: string | null) => void;
  setConnectingFromLandmark: (id: string | null) => void;
  setRelocatingLandmark: (id: string | null) => void;
  setPendingConnectionMeta: (meta: { type: ConnectionType; name?: string; description?: string }) => void;
  setEditorMode: (on: boolean) => void;
  setEditorTool: (tool: 'RAISE' | 'LOWER' | 'TERRAIN') => void;
  setEditorTerrain: (terrain: Terrain) => void;
  setRendererQualityProfile: (profile: RendererQualityProfile) => void;
  setMainView: (view: MainView) => void;
  setConfirmPending: (pending: boolean) => void;
  setProcessMode: (on: boolean) => void;
  setActiveProcessId: (id: string | null) => void;
  setActiveStageId: (id: string | null) => void;
  setPickingConnection: (picking: boolean) => void;
  setProcesses: (processes: Process[]) => void;
  setProcessesFetched: (fetched: boolean) => void;
  setProcessesLoading: (loading: boolean) => void;
  setProcessesError: (error: string | null) => void;
  // ── Quality Metrics ───────────────────────────────────────────────────────
  metrics: Record<string, QualityMetric>;
  setMetrics: (metrics: Record<string, QualityMetric>) => void;
  // ── Collaborator Matrix ───────────────────────────────────────────────────
  collaboratorMatrix: CollaboratorMatrix | null;
  setCollaboratorMatrix: (matrix: CollaboratorMatrix) => void;
  // ── Chore Lists ───────────────────────────────────────────────────────────
  choreLists: ChoreList[];
  choreListsFetched: boolean;
  choreListsLoading: boolean;
  choreListsError: string | null;
  activeChoreListId: string | null;
  setChoreLists: (lists: ChoreList[]) => void;
  setChoreListsFetched: (v: boolean) => void;
  setChoreListsLoading: (v: boolean) => void;
  setChoreListsError: (e: string | null) => void;
  setActiveChoreListId: (id: string | null) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  maps: [],
  currentMap: null,
  pendingTiles: new Map(),
  selectedTile: null,
  selectedLandmark: null,
  selectedConnectionId: null,
  connectingFromLandmarkId: null,
  relocatingLandmarkId: null,
  pendingConnectionMeta: { type: 'PIPE' as ConnectionType },
  editorMode: false,
  editorTool: 'RAISE',
  editorTerrain: 'GRASS',
  rendererQualityProfile: getInitialRendererQualityProfile(),
  mainView: 'metrics',
  confirmPending: false,
  processMode: false,
  activeProcessId: null,
  activeStageId: null,
  pickingConnection: false,
  processes: [],
  processesFetched: false,
  processesLoading: false,
  processesError: null,
  choreLists: [],
  choreListsFetched: false,
  choreListsLoading: false,
  choreListsError: null,
  activeChoreListId: null,
  metrics: {},
  setMetrics: (metrics) => set({ metrics }),
  collaboratorMatrix: null,
  setCollaboratorMatrix: (matrix) => set({ collaboratorMatrix: matrix }),
  setMaps: (maps) => set({ maps }),
  setCurrentMap: (map) => set((state) => ({
    currentMap: map,
    selectedTile: null,
    selectedLandmark: null,
    selectedConnectionId: null,
    mainView: (map == null || state.currentMap == null || state.currentMap.id !== map.id) ? 'metrics' : state.mainView,
    confirmPending: false,
    // Reset process state when switching maps
    processesFetched: false,
    processes: [],
    processMode: false,
    activeProcessId: null,
    activeStageId: null,
    pickingConnection: false,
    choreListsFetched: false,
    choreLists: [],
    activeChoreListId: null,
    metrics: {},
    collaboratorMatrix: null,
  })),
  updateMap: (map) =>
    set((state) => {
      if (state.currentMap?.id !== map.id) {
        return { maps: state.maps.map((m) => (m.id === map.id ? map : m)) };
      }
      // Merge incoming broadcast with any still-pending optimistic tiles so
      // out-of-order or stale WebSocket messages don't cause visible flicker.
      const pending = state.pendingTiles;
      let mergedTiles = map.map.tiles;
      if (pending.size > 0) {
        mergedTiles = map.map.tiles.map((t) => {
          const key = `${t.coordinate.q},${t.coordinate.r}`;
          return pending.get(key) ?? t;
        });
      }
      const mergedMap: SessionState = {
        ...map,
        map: { ...map.map, tiles: mergedTiles },
      };
      // Keep selectedLandmark in sync so edits are reflected immediately
      // without waiting for a page reload.
      const updatedSelectedLandmark =
        state.selectedLandmark && mergedMap.landmarks[state.selectedLandmark.id]
          ? mergedMap.landmarks[state.selectedLandmark.id]
          : state.selectedLandmark;
      return {
        currentMap: mergedMap,
        maps: state.maps.map((m) => (m.id === map.id ? mergedMap : m)),
        selectedLandmark: updatedSelectedLandmark,
      };
    }),
  updateTile: (mapId, tile) =>
    set((state) => {
      if (state.currentMap?.id !== mapId) return {};
      const key = `${tile.coordinate.q},${tile.coordinate.r}`;
      const newPending = new Map(state.pendingTiles);
      newPending.set(key, tile);
      const tiles = state.currentMap.map.tiles.map((t) =>
        t.coordinate.q === tile.coordinate.q && t.coordinate.r === tile.coordinate.r ? tile : t,
      );
      return {
        pendingTiles: newPending,
        currentMap: { ...state.currentMap, map: { ...state.currentMap.map, tiles } },
      };
    }),
  commitTile: (mapId, q, r) =>
    set((state) => {
      if (state.currentMap?.id !== mapId) return {};
      const key = `${q},${r}`;
      const newPending = new Map(state.pendingTiles);
      newPending.delete(key);
      return { pendingTiles: newPending };
    }),
  revertTile: (mapId, original) =>
    set((state) => {
      if (state.currentMap?.id !== mapId) return {};
      const key = `${original.coordinate.q},${original.coordinate.r}`;
      const newPending = new Map(state.pendingTiles);
      newPending.delete(key);
      const tiles = state.currentMap.map.tiles.map((t) =>
        t.coordinate.q === original.coordinate.q && t.coordinate.r === original.coordinate.r
          ? original
          : t,
      );
      return {
        pendingTiles: newPending,
        currentMap: { ...state.currentMap, map: { ...state.currentMap.map, tiles } },
      };
    }),
  setSelectedTile: (tile) => set({ selectedTile: tile }),
  setSelectedLandmark: (landmark) => set({ selectedLandmark: landmark }),
  setSelectedConnectionId: (id) => set({ selectedConnectionId: id }),
  setConnectingFromLandmark: (id) => set({ connectingFromLandmarkId: id }),
  setRelocatingLandmark: (id) => set({ relocatingLandmarkId: id }),
  setPendingConnectionMeta: (meta) => set({ pendingConnectionMeta: meta }),
  setEditorMode: (on) => set({ editorMode: on, mainView: on ? 'editor' : 'idle', processMode: false }),
  setEditorTool: (tool) => set({ editorTool: tool }),
  setEditorTerrain: (terrain) => set({ editorTerrain: terrain }),
  setRendererQualityProfile: (profile) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RENDERER_QUALITY_STORAGE_KEY, profile);
    }
    set({ rendererQualityProfile: profile });
  },
  setMainView: (view) => set((state) => ({
    mainView: view,
    editorMode: view === 'editor',
    processMode: view === 'process' ? state.processMode : false,
  })),
  setConfirmPending: (pending) => set({ confirmPending: pending }),
  setProcessMode: (on) => set((state) => ({
    processMode: on,
    mainView: on ? 'process' : state.mainView,
    editorMode: on ? false : state.editorMode,
    pickingConnection: on ? state.pickingConnection : false,
    selectedLandmark: on ? null : state.selectedLandmark,
    selectedTile: on ? null : state.selectedTile,
    selectedConnectionId: on ? null : state.selectedConnectionId,
  })),
  setActiveProcessId: (id) => set({ activeProcessId: id }),
  setActiveStageId: (id) => set({ activeStageId: id, pickingConnection: false }),
  setPickingConnection: (picking) => set({ pickingConnection: picking }),
  setProcesses: (processes) => set({ processes }),
  setProcessesFetched: (fetched) => set({ processesFetched: fetched }),
  setProcessesLoading: (loading) => set({ processesLoading: loading }),
  setProcessesError: (error) => set({ processesError: error }),
  setChoreLists: (lists) => set({ choreLists: lists }),
  setChoreListsFetched: (v) => set({ choreListsFetched: v }),
  setChoreListsLoading: (v) => set({ choreListsLoading: v }),
  setChoreListsError: (e) => set({ choreListsError: e }),
  setActiveChoreListId: (id) => set({ activeChoreListId: id }),
}));





