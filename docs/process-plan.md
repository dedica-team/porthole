# Process Feature Plan

> **Status:** In progress – StageConnection entity being added
> **Scope:** Per-map Process entities with ordered Stages and Landmark Connections, a map-canvas overlay toggle for Process Mode, and tile/connection highlighting on the Hex Grid.
> **Access:** Only collaborators may create, edit, or delete processes. Processes are **not** embedded in `MapState`; they are fetched on demand when a collaborator opens Process Mode, and eagerly for viewers on map load.

---

## Overview

A **Process** models a workflow or procedure that takes place on a map. It consists of ordered **Stages**, each containing directional **Connections** between Landmarks. Processes are scoped per map/session and are collaboratively editable via dedicated REST endpoints.

---

## 1. Data Model

### 1.1 TypeScript Types – `client/src/types/map.ts`

No new connection type is introduced. Process stages contain **`StageConnection` entities** — each one references an existing `Connection` by ID, but also carries its own `title` and `direction` (which may differ from the referenced connection's defaults).

```ts
export type StageConnectionDirection = 'FORWARD' | 'REVERSE' | 'BIDIRECTIONAL';

export interface StageConnection {
  id: string;                          // own entity ID (not the Connection ID)
  connectionId: string;                // ref to Connection.id in MapState.connections
  title?: string;                      // optional display title for this stage entry
  direction: StageConnectionDirection; // FORWARD = origin→target, REVERSE = target→origin, BIDIRECTIONAL
}

export interface ProcessStage {
  id: string;
  name?: string;
  order: number;                // 0-based, determines stage sequence
  connections: StageConnection[]; // ordered stage-connection entities
}

export interface Process {
  id: string;
  name: string;
  description?: string;
  stages: ProcessStage[];
}

/** Single highlight colour used for all process connection/tile highlights. */
export const PROCESS_HIGHLIGHT_COLOR = '#38bdf8'; // sky-400
```

`MapState` does **not** gain a `processes` field on the TypeScript side — processes are stored in a separate Zustand slice (see §4) and are never part of the WebSocket broadcast payload.

> **Why a separate `StageConnection` entity?** The referenced `Connection` defines the physical path between two landmarks. The `StageConnection` adds process-specific semantics: an optional title (e.g. "Send report") and a direction that may differ from the connection's own orientation. Multiple stages in different processes can reference the same underlying `Connection` with different titles and directions.

### 1.2 Backend Kotlin Domain Classes – `server/src/main/kotlin/.../domain/`

**`StageConnection.kt`** *(new)*
```kotlin
data class StageConnection(
    val id: String = UUID.randomUUID().toString(),
    val connectionId: String,                        // ref to MapState.connections key
    var title: String? = null,
    var direction: StageConnectionDirection = StageConnectionDirection.FORWARD,
)

enum class StageConnectionDirection { FORWARD, REVERSE, BIDIRECTIONAL }
```

**`Process.kt`**
```kotlin
data class Process(
    val id: String = UUID.randomUUID().toString(),
    var name: String,
    var description: String? = null,
    val stages: MutableList<ProcessStage> = mutableListOf(),
)
```

**`ProcessStage.kt`**
```kotlin
data class ProcessStage(
    val id: String = UUID.randomUUID().toString(),
    var name: String? = null,
    var order: Int,   // mutable – can be changed via EditProcessStageUseCase / ReorderProcessStagesUseCase
    val connections: MutableList<StageConnection> = mutableListOf(),
)
```

`MapState` gains:
```kotlin
val processes: MutableMap<String, Process> = mutableMapOf()
```

> ⚠️ **`MapState` does NOT expose `processes` in the WebSocket broadcast payload.** The `MapStateBroadcaster` uses a dedicated broadcast DTO that excludes the `processes` field.

---

## 2. Backend API Endpoints

New controller: `ProcessController.kt` — base path `/api/sessions/{id}/processes`

| Method   | Path                                                          | Access            | Description                                         |
|----------|---------------------------------------------------------------|-------------------|-----------------------------------------------------|
| `GET`    | `/`                                                           | All participants  | Load all processes for a map (on demand)            |
| `POST`   | `/`                                                           | Collaborator only | Create a process                                    |
| `PATCH`  | `/{processId}`                                                | Collaborator only | Edit name / description                             |
| `DELETE` | `/{processId}`                                                | Collaborator only | Delete a process                                    |
| `POST`   | `/{processId}/stages`                                         | Collaborator only | Add a stage                                         |
| `PATCH`  | `/{processId}/stages/{stageId}`                               | Collaborator only | Edit a stage (rename, change order)                 |
| `POST`   | `/{processId}/stages/reorder`                                 | Collaborator only | Reassign `order` values to match a given ID list    |
| `DELETE` | `/{processId}/stages/{stageId}`                               | Collaborator only | Remove a stage                                      |
| `POST`   | `/{processId}/stages/{stageId}/connections`                   | Collaborator only | Add a StageConnection to a stage                    |
| `PATCH`  | `/{processId}/stages/{stageId}/connections/{stageConnId}`     | Collaborator only | Edit a StageConnection (title, direction)           |
| `DELETE` | `/{processId}/stages/{stageId}/connections/{stageConnId}`     | Collaborator only | Remove a StageConnection from a stage               |

- `GET /` is accessible to all map participants (viewers included).
- All mutating endpoints are guarded by `requireCollaborator(mapId, token)` → `403 Forbidden` for viewers.
- All mutating endpoints return the full updated `List<Process>` (sorted by name).

### Request DTOs – `MapRequestDtos.kt`

```kotlin
data class CreateProcessRequest(val name: String, val description: String? = null)
data class EditProcessRequest(val name: String? = null, val description: String? = null)
data class CreateProcessStageRequest(val name: String? = null, val order: Int)
data class EditProcessStageRequest(val name: String? = null, val clearName: Boolean = false, val order: Int? = null)
data class ReorderProcessStagesRequest(val stageIds: List<String>)
// direction: "FORWARD" | "REVERSE" | "BIDIRECTIONAL" (default FORWARD)
data class AddStageConnectionRequest(
    val connectionId: String,
    val title: String? = null,
    val direction: String = "FORWARD",
)
data class EditStageConnectionRequest(
    val title: String? = null,
    val clearTitle: Boolean = false,
    val direction: String? = null,
)
```

### Use Cases

Located under `application/session/processes/`, one class per operation:

- `ListProcessesUseCase`
- `CreateProcessUseCase`
- `EditProcessUseCase`
- `RemoveProcessUseCase`
- `AddProcessStageUseCase`
- `EditProcessStageUseCase` — patches `name` and/or `order`; re-sorts stages by order after update
- `ReorderProcessStagesUseCase` — accepts an ordered list of stage IDs and assigns `order = index`
- `RemoveProcessStageUseCase`
- `AddStageConnectionUseCase` — creates a new `StageConnection` entity (own ID, `connectionId` ref, optional `title`, `direction`)
- `EditStageConnectionUseCase` — patches `title` (or clears it) and/or `direction` on an existing `StageConnection`
- `RemoveStageConnectionUseCase`

Use cases do **not** call `broadcastPort.send` — process mutations are not broadcast over WebSocket.

---

## 3. Persistence

`Process` and `ProcessStage` are plain data classes serialised automatically by Jackson as part of `MapState` (JSON-persisted by `JsonMapStateRepository`).

**Cascade cleanup on deletion:** `RemoveLandmarkUseCase` and `RemoveConnectionUseCase` iterate over all process stages and remove any `StageConnection` entries whose `connectionId` matches the deleted connection before persisting and broadcasting the updated `MapState`. The frontend detects the connection key removal in `updateMap` and re-fetches processes (see §4 cascade re-fetch).

---

## 4. Zustand Store – `client/src/store/mapStore.ts`

### State fields

```ts
processMode: boolean;
activeProcessId: string | null;
activeStageId: string | null;      // ID of the currently expanded stage accordion; null = all collapsed

// Lazy-loaded process list (not part of MapState / WebSocket broadcast):
processes: Process[];
processesFetched: boolean;
processesLoading: boolean;
processesError: string | null;
```

### Actions

```ts
setProcessMode(on: boolean): void;
setActiveProcessId(id: string | null): void;
setActiveStageId(id: string | null): void;
setProcesses(processes: Process[]): void;
setProcessesFetched(fetched: boolean): void;
setProcessesLoading(loading: boolean): void;
setProcessesError(error: string | null): void;
```

### Mutual exclusion rules

- `setProcessMode(true)` → sets `editorMode = false`, `mainView = 'process'`
- `setEditorMode(true)` → sets `processMode = false`, `mainView = 'editor'`
- `setMainView(view)` → sets `processMode = false` for any `view !== 'process'`; preserves `processMode` when `view === 'process'`

### `setCurrentMap` reset behaviour

`setCurrentMap` **always** resets `processesFetched = false`, `processes = []`, `processMode = false`, `activeProcessId = null`, `activeStageId = null` — even when called with the same map ID. This ensures process data is always re-fetched after navigation.

### Cascade re-fetch

`MapPage.tsx` tracks `currentMap.connections` keys. When a key disappears from the connections map (i.e. a connection was deleted server-side and broadcast), it calls `fetchProcesses` again so that any dangling `connectionId` references removed server-side are reflected in the UI.

---

## 5. Mode Toggle Buttons – `client/src/pages/MapPage/MapPage.tsx`

Process Mode and Landscape Editor are toggled via **overlay buttons** rendered in the top-left corner of the map canvas, **not** in the Navbar. They are only shown when `isCollaborator === true`.

```tsx
{isCollaborator && (
  <div className="absolute top-2 left-2 flex flex-row gap-1.5 z-10">
    {/* Process toggle */}
    <Button
      className={`... ${processMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 ...' : '...'}`}
      onClick={handleProcessToggle}
    >
      <Workflow className="h-4 w-4 shrink-0" />
      <span>{processMode ? 'Exit processes' : 'Processes'}</span>
    </Button>

    {/* Editor toggle */}
    <Button
      className={`... ${editorMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 ...' : '...'}`}
      onClick={handleEditorToggle}
    >
      <Pencil className="h-4 w-4 shrink-0" />
      <span>{editorMode ? 'Exit landscape editor' : 'Landscape editor'}</span>
    </Button>
  </div>
)}
```

`handleProcessToggle` enables process mode and triggers the lazy fetch of processes if `!processesFetched`. Viewers do not see the button; their processes are fetched eagerly on map load (see §8).

The Navbar contains view-switcher buttons for `metrics`, `matrix`, and `idle` only.

---

## 6. Process Sidebar Panel – `client/src/components/Sidebar/panels/ProcessPanel.tsx`

`Sidebar.tsx` renders `<ProcessPanel />` when `processMode === true`.

The panel has **two views**:

### 6.1 Process List View (`activeProcessId === null`)

- Header: "Processes" title + `HelpCircle` tooltip explaining the feature + **"New"** button
- While `processesLoading`: spinner
- If `processesError`: error message + **"Retry"** button
- Each process row: process name, stage count badge, inline **Pencil** icon that opens the Edit Process dialog directly
- Clicking a row navigates to the Process Detail View (`setActiveProcessId`)

### 6.2 Process Detail View (`activeProcessId` set)

- Header: **Back** (`ChevronLeft`) button + process name + **Pencil** (edit dialog) + **Trash** (delete, with inline confirm)
- Optional description shown below header
- Stages rendered as a **collapsible accordion**, sorted by `order` ascending:
  - Collapsed row: chevron icon + stage name/label (e.g. "Stage 1") + connection count
  - Clicking a row expands it (`setActiveStageId`); clicking again collapses it
  - **Expanded accordion body** contains:
    - Action bar: **Pencil** (edit stage name dialog), **ChevronUp** / **ChevronDown** (move stage up/down), **Trash** (delete stage, with inline confirm)
    - `HelpCircle` tooltip: *"While this stage is open, clicking a connection line on the map adds or removes it from the stage."*
    - List of assigned `StageConnection` entries: `<title or connection name/type> · <origin> → <target>` (arrow direction reflects `direction` field) + **Pencil** (edit title/direction) + **Trash** to remove
- **"Add Stage"** button below the stage list (inline input or `✕` to cancel)

**Dialogs:**
- *Edit Process* dialog: name + description fields
- *Edit Stage Name* dialog: single name field

---

## 7. Frontend API – `client/src/api/mapApi.ts`

```ts
fetchProcesses(mapId): Promise<Process[]>

createProcess(mapId, name, description?): Promise<Process[]>
editProcess(mapId, processId, name?, description?): Promise<Process[]>
removeProcess(mapId, processId): Promise<Process[]>

createProcessStage(mapId, processId, name?, order): Promise<Process[]>
editProcessStage(mapId, processId, stageId, patch: { name?, clearName?, order? }): Promise<Process[]>
reorderProcessStages(mapId, processId, stageIds: string[]): Promise<Process[]>
removeProcessStage(mapId, processId, stageId): Promise<Process[]>

// stageConnId is the StageConnection's own ID, not the underlying Connection ID
addConnectionToStage(mapId, processId, stageId, connectionId, title?, direction?): Promise<Process[]>
editStageConnection(mapId, processId, stageId, stageConnId, patch: { title?, clearTitle?, direction? }): Promise<Process[]>
removeConnectionFromStage(mapId, processId, stageId, stageConnId): Promise<Process[]>
```

All mutating calls store the returned `Process[]` via `setProcesses(result)`.

**Stage reordering (move up/down):** `ProcessPanel` calls `reorderProcessStages` after swapping two adjacent stage IDs in the sorted array.

**Stage renaming:** `ProcessPanel` calls `editProcessStage` with `{ name, clearName }`.

**StageConnection edit:** `ProcessPanel` calls `editStageConnection` when the user changes the title or direction of an existing stage entry.

---

## 8. Connection-Selection Flow – `client/src/pages/MapPage/MapPage.tsx`

### 8.1 Viewer fetch

When `!isCollaborator` and `currentMap` loads, `MapPage` eagerly calls `fetchProcesses(currentMap.id)` and stores the result. `processMode` stays `false` for viewers; they see the tile highlight rings and connection dimming passively.

### 8.2 Collaborator interaction

When `processMode` is active and `activeStageId` is set, `HexGrid` receives `onConnectionClick={handleProcessConnectionClick}`.

`handleProcessConnectionClick`:
1. Checks if a `StageConnection` with the matching `connectionId` already exists in the active stage
2. If yes → calls `removeConnectionFromStage` with the `StageConnection`'s own ID (toggle off)
3. If no → calls `addConnectionToStage` with the underlying `connectionId` and default direction `FORWARD` (toggle on)
4. Stores returned `Process[]` via `setProcesses`

Tile clicks are **no-ops** while `processMode` is active.

### 8.3 Computed values passed to HexGrid

```ts
// All underlying connection IDs across all stages of the active process (used for dimming)
// Derived from StageConnection.connectionId for each entry in each stage
activeProcessConnectionIds: Set<string> | undefined

// Connection IDs of the currently open stage only (used to hide regular meshes,
// replaced by the process arrow overlay)
// Derived from the active stage's connections array when activeStageId is set
activeStageConnectionIds: Set<string> | undefined

// All tile coordinates (path tiles + landmark tiles) of the active process (or active stage)
// Derived from MapState.connections[stageConn.connectionId].path for each StageConnection
activeStageHighlightTiles: Set<string> | undefined

// Resolved StageConnection + Connection pairs for the active stage (drives arrow overlay)
processStageConnections: Array<{ stageConn: StageConnection; connection: Connection }> | undefined
```

`activeProcessConnectionIds` covers all stages (for dimming non-process connections). `activeStageConnectionIds` covers only the open stage (for hiding regular meshes replaced by arrows). `activeStageHighlightTiles` is scoped to the open stage when `activeStageId` is set, otherwise covers the whole process.

---

## 9. HexGrid Visualisation – `client/src/components/HexGrid/HexGrid.tsx`

Process connections are visualised in two layers that are only active when a process is selected and a stage is open.

### 9.1 Connection dimming & replacement (`highlightConnectionIds` prop)

```ts
highlightConnectionIds?: Set<string>
```

When set, all **regular** connection meshes (the always-on terrain layer) **not** in the set are dimmed to `opacity = 0.18`. Connections **in** the set that also belong to the active stage are **hidden entirely** (`visible = false`) — they are replaced by the process arrow overlay (§9.3) so the original appearance is not shown alongside the arrow. Connections in the set that belong to the active process but not the currently open stage remain at full opacity (not hidden, not dimmed). Effect runs on every change to the prop.

### 9.2 Tile ring highlight (`highlightTileCoords` prop)

```ts
highlightTileCoords?: Set<string>  // "q,r" strings
```

For each coordinate in the set, a flat annular hex ring (6 quads, sky-blue, `opacity = 0.55`) is rendered just above the tile top face (`y + 0.04`). All rings are merged into a single `THREE.Mesh` for one draw call. Ring: inner radius `0.80 * HEX_SIZE`, outer radius `0.97 * HEX_SIZE`.

Color: `PROCESS_HIGHLIGHT_COLOR` (`#38bdf8`, sky-400) — the same single colour is used for all process highlights regardless of stage.

### 9.3 Process Arrow Overlay – `ProcessArrowRenderer.ts` *(new)*

When an active stage is open, a dedicated `ProcessArrowRenderer` builds a separate `THREE.Group` that sits **above** the regular connection layer. One arrow mesh is built per `StageConnection` in the active stage.

#### 9.3.1 Arrow geometry

Each arrow reuses the same spine-curve + ribbon approach as `ArrowRenderer` (the existing connection type), with the following differences:

| Property | Regular `ArrowRenderer` | Process overlay |
|----------|------------------------|-----------------|
| Color | `0x00e5ff` (cyan) | `PROCESS_HIGHLIGHT_COLOR` (`0x38bdf8`) |
| Opacity | 0.85 | 0.72 (slightly more transparent to show terrain beneath) |
| Y lift | terrain + 0.12 | terrain + 0.30 (hovers clearly above terrain connections) |
| Shaft width | 0.22 | 0.18 |
| Head width | 0.52 | 0.44 |

The path is taken from `MapState.connections[stageConn.connectionId].path`. When `direction === 'REVERSE'` the path array is reversed before building the spine curve so the arrowhead points the other way. When `direction === 'BIDIRECTIONAL'` two arrows are built on the same path — one forward, one reverse — each with half opacity (`0.36`) so the combined visual weight is similar.

#### 9.3.2 Title label

When `StageConnection.title` is set, a flat label is rendered **alongside the arrow**, aligned to the arc of the path:

- **Technique:** A `THREE.PlaneGeometry` with a `THREE.CanvasTexture` (same approach as the existing `namePlane` utility in `landmarkUtils.ts`).
- **Canvas size:** 512 × 80 px; font: `bold 40px monospace`; text color: white; no background (transparent).
- **Placement:** The label centre is positioned at the parametric midpoint of the spine curve, elevated `0.35` above terrain. It is rotated flat (`rotation.x = -π/2`) so it lies horizontally and faces upward (readable from above like landmark names).
- **Orientation:** An additional `rotation.y` aligns the label's long axis with the arrow's tangent direction at the midpoint, so it reads parallel to the arrow rather than perpendicular to it.
- **Caching:** Labels are cached by `"<title>|<stageConnId>"` key — the cache is cleared when `ProcessArrowRenderer.dispose()` is called.

#### 9.3.3 Integration in `HexGrid.tsx`

New optional props:

```ts
processStageConnections?: Array<{
  stageConn: StageConnection;
  connection: Connection;  // resolved from MapState.connections
}>

/** Connection IDs whose regular mesh should be hidden (replaced by the arrow overlay). */
activeStageConnectionIds?: Set<string>
```

- On mount: create `processArrowRendererRef`; add its `THREE.Group` to the scene.
- When `processStageConnections` changes (stage expanded or connections added/removed): call `processArrowRendererRef.current.update(processStageConnections, tiles)`. The renderer disposes old geometry and rebuilds.
- When `processStageConnections` is `undefined` or empty (no stage open): the renderer clears its group (no arrows shown) and all regular connection meshes are un-hidden.
- The `activeStageConnectionIds` prop drives the visibility toggle in §9.1: regular meshes whose ID is in this set are set to `visible = false` while the stage is open, and restored to `visible = true` when the stage closes or the process is deactivated.

`MapPage.tsx` derives `processStageConnections` and `activeStageConnectionIds` from the active stage's `connections` array, resolved against `currentMap.connections`, and passes both to `<HexGrid>`.

> **No `ProcessArrowRenderer` was implemented in the previous iteration.** This section describes the intended implementation going forward. Tile rings (§9.2) and dimming (§9.1) remain in place as a complementary layer.

---

## 10. WebSocket Integration

Processes are **not** part of the `MapState` WebSocket broadcast. Each mutating API call returns the updated `Process[]` list directly; that list is stored in the Zustand store by the caller.

**Cascade re-fetch:** `MapPage` compares `currentMap.connections` key sets on every `updateMap`. When a connection key disappears, it calls `fetchProcesses` to pick up any server-side cleanup of dangling stage references.

Real-time multi-user process editing is **not supported** — last write wins.

---

## 11. Tests

### Frontend

| Test file | Coverage |
|-----------|----------|
| `ProcessPanel.test.tsx` | Render process list, create process, add stage, connection pick flow |
| `processStore.test.ts` | Process mode transitions, mutual exclusion with editor mode, `setCurrentMap` reset |
| `mapApi.process.test.ts` | All API functions (mock fetch), including `editProcessStage` and `reorderProcessStages` |

### Backend

| Test class | Coverage |
|------------|----------|
| `CreateProcessUseCaseTest.kt` | Process creation, name validation |
| `AddProcessStageUseCaseTest.kt` | Stage ordering |

---

## 12. Design Decisions

1. **Landmark / connection deletion cascade** — When a landmark or connection is deleted, any `connectionId` references to it inside process stages are silently removed inside `RemoveLandmarkUseCase` / `RemoveConnectionUseCase` on the server. The server then broadcasts the updated `MapState`; the frontend detects the key removal and re-fetches processes.

2. **Single highlight colour** — All process connection and tile highlights use `PROCESS_HIGHLIGHT_COLOR` (sky-400, `#38bdf8`). Per-stage colours were considered but not implemented.

3. **Viewer access** — Viewers can see the tile ring highlights and connection dimming. `fetchProcesses` and `GET /processes` are accessible to all map participants. Only mutating endpoints remain collaborator-only.

4. **Active process** — Only one process can be active at a time (`activeProcessId`). There is no "show all" mode.

5. **Stage reordering** — Supported via two mechanisms: `reorderProcessStages` (bulk reorder by passing an ordered ID list) used by the move-up/down buttons in `ProcessPanel`, and `editProcessStage` (set an explicit `order` value). The UI exposes move-up / move-down buttons per stage in the expanded accordion.

6. **Mode toggle location** — Process and editor toggles are rendered as an overlay on the map canvas (`MapPage.tsx`), not as Navbar buttons. This keeps the Navbar uncluttered and makes the toggles contextually visible only when the map is in view.

