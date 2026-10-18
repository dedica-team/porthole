# Chore Todo Lists Feature Plan

> **Status:** Draft
> **Scope:** Per-map Chore Lists, each with a configurable set of landmark entries carrying state, assignee, and link. Full CRUD for collaborators, read-only for viewers. Real-time sync via the existing WebSocket broadcast.

---

## 1. Data Model

### 1.1 TypeScript Types — `client/src/types/map.ts`

Add the following types and style constants, following the patterns of `QualityLevel` / `QUALITY_LEVEL_BADGE_STYLE`:

```ts
export type ChoreEntryState = 'NONE' | 'ONGOING' | 'BLOCKED' | 'DONE';

export const CHORE_ENTRY_STATE_LABEL: Record<ChoreEntryState, string> = {
  NONE:    'None',
  ONGOING: 'Ongoing',
  BLOCKED: 'Blocked',
  DONE:    'Done',
};

export const CHORE_ENTRY_STATE_BADGE_STYLE: Record<ChoreEntryState, React.CSSProperties> = {
  NONE:    { background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.4)' },
  ONGOING: { background: 'rgba(245,158,11,0.15)',  color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' },
  BLOCKED: { background: 'rgba(239,68,68,0.15)',   color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)' },
  DONE:    { background: 'rgba(34,197,94,0.15)',   color: '#86efac', border: '1px solid rgba(34,197,94,0.4)' },
};

export interface ChoreEntry {
  landmarkId: string;
  state: ChoreEntryState;
  assigneeId?: string;   // optional: references a Collaborator.id
  link?: string;
  note?: string;         // optional free-text note
}

export interface ChoreList {
  id: string;
  title: string;
  completed: boolean;
  entries: Record<string, ChoreEntry>;  // keyed by landmarkId
}
```

`MapState` does **not** gain a `choreLists` field on the TypeScript side. Chore lists are fetched on demand and stored in a dedicated Zustand slice (§4), following the same pattern as `Process`.

---

### 1.2 Backend Kotlin Domain — `server/src/main/kotlin/…/domain/`

**New file: `ChoreEntryState.kt`**
```kotlin
package team.dedica.porthole.domain
enum class ChoreEntryState { NONE, ONGOING, BLOCKED, DONE }
```

**New file: `ChoreEntry.kt`**
```kotlin
package team.dedica.porthole.domain
data class ChoreEntry(
    val landmarkId: String,
    var state: ChoreEntryState = ChoreEntryState.NONE,
    var assigneeId: String? = null,
    var link: String? = null,
    var note: String? = null,
)
```

**New file: `ChoreList.kt`**
```kotlin
package team.dedica.porthole.domain
import java.util.UUID

data class ChoreList(
    val id: String = UUID.randomUUID().toString(),
    var title: String,
    var completed: Boolean = false,
    val entries: MutableMap<String, ChoreEntry> = mutableMapOf(), // keyed by landmarkId
)
```

**Modify `MapState.kt`** — add one field to the `data class`:
```kotlin
val choreLists: MutableMap<String, ChoreList> = mutableMapOf()
```

Jackson/`JsonStore` serialises all `MutableMap` fields automatically; no custom deserializer is needed.

---

## 2. Backend REST API

**New controller: `ChoreListController.kt`**
Base path: `/api/sessions/{id}/chore-lists`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List all chore lists (title + entries) | Collaborator or viewer |
| `POST` | `/` | Create a chore list (title + landmark IDs) | Collaborator only |
| `PATCH` | `/{listId}` | Edit title and/or landmark set | Collaborator only |
| `PATCH` | `/{listId}/complete` | Toggle `completed` flag | Collaborator only |
| `DELETE` | `/{listId}` | Delete a chore list | Collaborator only |
| `PATCH` | `/{listId}/entries/{landmarkId}` | Update a single entry (state, assigneeId, link, note) | Collaborator only |

All write endpoints resolve the caller from ` UserDetails` and call `state.requireCollaborator(user.id)` — throwing `IllegalArgumentException` → 400 (handled by `GlobalExceptionHandler`) for viewers. Viewers calling write endpoints receive the same 400 with message "User … is not a collaborator on map …".

**DTO additions to `MapRequestDtos.kt`:**
```kotlin
data class CreateChoreListRequest(
    @field:NotBlank val title: String,
    val landmarkIds: List<String> = emptyList(),
)

data class EditChoreListRequest(
    val title: String? = null,
    val landmarkIds: List<String>? = null,
)

data class UpdateChoreEntryRequest(
    val state: ChoreEntryState? = null,
    val assigneeId: String? = null,
    val clearAssignee: Boolean = false,
    val link: String? = null,
    val clearLink: Boolean = false,
    val note: String? = null,
    val clearNote: Boolean = false,
)
```

---

## 3. Backend Use Cases — `application/session/chorelists/`

Mirrors the `processes/` package structure.

| File | Responsibility |
|------|---------------|
| `ListChoreListsUseCase.kt` | Returns all `ChoreList` values from the map, sorted by title |
| `CreateChoreListUseCase.kt` | Validates title non-blank; creates a `ChoreEntry` (state=NONE) for each provided landmark ID; validates each landmark exists on the map; persists and broadcasts |
| `EditChoreListUseCase.kt` | Updates title if provided; reconciles landmark set (removes entries for any landmark IDs no longer in the list, adds new entries with state=NONE for newly added IDs); persists and broadcasts |
| `RemoveChoreListUseCase.kt` | Removes the list from the map; persists and broadcasts |
| `ToggleChoreListCompletedUseCase.kt` | Flips `completed` on the list; persists and broadcasts |
| `UpdateChoreEntryUseCase.kt` | Finds the entry by `landmarkId`; applies `state`, `assigneeId` (or clears it), `link` (or clears it), `note` (or clears it); validates `assigneeId` is an actual collaborator if set; persists and broadcasts |

Each use case injects `MapStatePort`, `UserWritePort`, and `BroadcastPort` (same as `CreateProcessUseCase`).

---

## 4. Frontend Store — `client/src/store/mapStore.ts`

**Extend `MainView`:**
```ts
export type MainView = 'idle' | 'tile' | 'landmark' | 'editor' | 'groups'
                     | 'metrics' | 'matrix' | 'process' | 'chores';
```

**Add chore-list slice to `MapStore` interface:**
```ts
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
```

**Add initial values** to `useMapStore` `create(...)` call:
```ts
choreLists: [],
choreListsFetched: false,
choreListsLoading: false,
choreListsError: null,
activeChoreListId: null,
```

**Reset in `setCurrentMap`** (same pattern as the existing process reset block):
```ts
choreListsFetched: false,
choreLists: [],
activeChoreListId: null,
```

---

## 5. API Client — `client/src/api/mapApi.ts`

Add five functions using the existing `authHeaders()` / `handleResponse<T>()` helpers:

```ts
export async function fetchChoreLists(mapId: string): Promise<ChoreList[]>
export async function createChoreList(mapId: UUID, title: string, landmarkIds: string[]): Promise<ChoreList[]>
export async function editChoreList(mapId: UUID, listId: string, title?: string, landmarkIds?: string[]): Promise<ChoreList[]>
export async function toggleChoreListCompleted(mapId: UUID, listId: string): Promise<ChoreList>
export async function deleteChoreList(mapId: UUID, listId: string): Promise<void>
export async function updateChoreEntry(
  mapId: UUID,
  listId: string,
  landmarkId: string,
  patch: { state?: ChoreEntryState; assigneeId?: string | null; link?: string | null; note?: string | null }
): Promise<ChoreList>
```

`deleteChoreList` uses a `res.ok` check without parsing a body (204 No Content). All others use `handleResponse<T>`.

---

## 6. UI Components

### 6.1 `ChoreListsView` — `client/src/components/ChoreListsView/ChoreListsView.tsx`

The top-level view rendered when `mainView === 'chores'`.

- On mount (and when `currentMap.id` changes), calls `fetchChoreLists` → stores result via `setChoreLists`, sets `choreListsFetched`.
- If `activeChoreListId` is set, renders `<ChoreListDetail />` instead of the overview.
- **Overview layout:** scrollable list of cards, one per `ChoreList`. Completed lists are visually dimmed (reduced opacity) and sorted below incomplete ones. Each card shows:
  - **Title** (left, bold). Completed lists show the title with a strikethrough.
  - Four state-count pills — one per `ChoreEntryState`, using `CHORE_ENTRY_STATE_BADGE_STYLE` colors (e.g. `DONE: 3`, `ONGOING: 1`). Counts of `0` can be shown dimly or hidden.
  - **"Open" button** → sets `activeChoreListId`.
  - **Complete / Reopen toggle button** (collaborators only, checkmark icon): calls `toggleChoreListCompleted`, updates store.
  - **Delete icon button** (collaborators only, with confirmation).
- Collaborator toolbar: **"+ New List"** button opens `<CreateChoreListDialog>`.
- Loading and error states handled.

### 6.2 `ChoreListDetail` — `client/src/components/ChoreListsView/ChoreListDetail.tsx`

Shown when `activeChoreListId` is set.

- **Header:** back-chevron button (clears `activeChoreListId`), list title (strikethrough when `completed`), optional **"Edit"** icon (pencil, collaborators only) opens `<EditChoreListDialog>`, **Complete / Reopen** toggle button and **Delete** button (collaborators only, with confirmation).
- Resolves entries from the active `ChoreList`; sorts them by the landmark name (looked up from `currentMap.landmarks`).
- Renders a `<ChoreEntryRow>` for each entry.
- Non-blocking error banner for entry-update failures.

### 6.3 `ChoreEntryRow` — `client/src/components/ChoreListsView/ChoreEntryRow.tsx`

One row per chore entry:

| Column | Collaborator | Viewer |
|--------|-------------|--------|
| Landmark name | Plain text (`Landmark.name`) | Same |
| State | shadcn `<Select>` with styled option items | Read-only `<Badge>` using `CHORE_ENTRY_STATE_BADGE_STYLE` |
| Assignee | `<Popover>` with collaborator list (avatar + name) and "Unassigned" option | Avatar + username or "—" |
| Link | `<Input type="url">` (save on blur / Enter) with external-link icon | Clickable link or "—" |
| Note | `<Textarea>` (save on blur, max ~280 chars) | Plain text or "—" |

State changes and assignee picks call `updateChoreEntry` immediately (optimistic: update local store, revert on error). Link saves on blur.

### 6.4 `CreateChoreListDialog` — `client/src/components/ChoreListsView/CreateChoreListDialog.tsx`

shadcn `<Dialog>`:
- `<Input>` for title (required).
- Scrollable checkbox list of **non-decorative** landmarks from `currentMap.landmarks`, sorted by name.
- "Select all" / "Clear" shortcuts.
- "Create" button (disabled while saving): calls `createChoreList`, updates store, closes dialog.
- Inline error on failure.

### 6.5 `EditChoreListDialog` — `client/src/components/ChoreListsView/EditChoreListDialog.tsx`

Same layout as `CreateChoreListDialog`, pre-filled with the current list's title and checked landmark IDs. On save, calls `editChoreList`. Backend reconciles entries: keeps state/assignee/link for unchanged landmarks, creates state=NONE entries for newly added ones, removes entries for de-selected ones.

---

## 7. Navbar Integration — `client/src/components/Navbar/Navbar.tsx`

Add a new nav-tab button in the view-switcher section (after the existing X-Ray button), following the exact same JSX pattern:

```tsx
import { CheckSquare } from 'lucide-react';
// …
<Tooltip>
  <TooltipTrigger asChild>
    <button
      className={`inline-flex items-center gap-1.5 h-12 px-3 text-xs font-medium border-b-3 transition-colors cursor-pointer ${
        mainView === 'chores'
          ? 'border-[hsl(185,100%,54%)] text-[hsl(185,100%,54%)]'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => setMainView('chores')}
      aria-current={mainView === 'chores' ? 'page' : undefined}
    >
      <CheckSquare className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Chores</span>
    </button>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="text-xs">Chore todo lists per landmark</TooltipContent>
</Tooltip>
```

---

## 8. MapPage Integration — `client/src/pages/MapPage/MapPage.tsx`

Add a `mainView === 'chores'` branch in the view render block (after or before the `matrix` branch):

```tsx
} : mainView === 'chores' ? (
  <ChoreListsView />
) : processMode ? (
```

Hide the sidebar for the chores view (same condition used for `metrics` and `matrix`):
```tsx
<AppShell sidebar={mainView !== 'metrics' && mainView !== 'matrix' && mainView !== 'chores' ? sidebar : undefined}>
```

---

## 9. WebSocket / Real-time Sync — `client/src/hooks/useMapWebSocket.ts`

**Design choice — include chore lists in the broadcast.** Chore lists are small (bounded by landmark count); including them in `MapStateBroadcastDto` alongside `collaboratorMatrix` avoids a separate version-signal mechanism.

**`MapStateBroadcastDto.kt`** — add field and update `from()`:
```kotlin
val choreLists: Map<String, ChoreList> = emptyMap(),
// in from():
choreLists = state.choreLists,
```

**`useMapWebSocket.ts`** — parse `choreLists` from the broadcast before calling `updateMap`:
```ts
const payload = JSON.parse(message.body) as MapState & { choreLists?: Record<string, ChoreList> };
if (payload.choreLists) {
  setChoreLists(Object.values(payload.choreLists));
}
updateMap(payload);
```

This keeps `MapState` (frontend type) clean and co-locates sync logic with the WebSocket hook.

---

## 10. File Structure

### New Files

**Backend**
```
server/src/main/kotlin/…/domain/
  ChoreEntryState.kt
  ChoreEntry.kt
  ChoreList.kt

server/src/main/kotlin/…/application/session/chorelists/
  ListChoreListsUseCase.kt
  CreateChoreListUseCase.kt
  EditChoreListUseCase.kt
  RemoveChoreListUseCase.kt
  ToggleChoreListCompletedUseCase.kt
  UpdateChoreEntryUseCase.kt

server/src/main/kotlin/…/adapter/in/web/
  ChoreListController.kt
```

**Frontend**
```
client/src/components/ChoreListsView/
  ChoreListsView.tsx
  ChoreListDetail.tsx
  ChoreEntryRow.tsx
  CreateChoreListDialog.tsx
  EditChoreListDialog.tsx
```

### Modified Files

| File | Change summary |
|------|---------------|
| `domain/MapState.kt` | Add `choreLists: MutableMap<String, ChoreList>` field |
| `adapter/in/web/dto/MapRequestDtos.kt` | Add `CreateChoreListRequest`, `EditChoreListRequest`, `UpdateChoreEntryRequest` |
| `adapter/out/messaging/MapStateBroadcastDto.kt` | Add `choreLists: Map<String, ChoreList>` and populate in `from()` |
| `client/src/types/map.ts` | Add `ChoreEntryState`, `ChoreEntry`, `ChoreList` types and style/label constants |
| `client/src/store/mapStore.ts` | Extend `MainView`, add chore-list slice, reset in `setCurrentMap` |
| `client/src/api/mapApi.ts` | Add 5 chore-list API functions |
| `client/src/hooks/useMapWebSocket.ts` | Parse `choreLists` from broadcast, call `setChoreLists` |
| `client/src/components/Navbar/Navbar.tsx` | Add Chores nav tab (CheckSquare icon) |
| `client/src/pages/MapPage/MapPage.tsx` | Import and render `<ChoreListsView>` for `mainView === 'chores'`; hide sidebar |
| `adapter/out/persistence/DemoDataLoader.kt` | Add `createChoreLists()` with two example chore lists (§12) |

---

## 11. Implementation Order

1. **Domain model** — Add `ChoreEntryState`, `ChoreEntry`, `ChoreList` Kotlin classes; add `choreLists` to `MapState`.
2. **Persistence smoke-test** — Verify `JsonStore` round-trips `choreLists` correctly with a unit test.
3. **Demo data** — Add two example chore lists to `DemoDataLoader` (see §12).
3. **DTOs** — Add the three request DTOs to `MapRequestDtos.kt`.
4. **Use cases** — Implement the six use cases in `application/session/chorelists/`.
5. **Controller** — Implement `ChoreListController` wired to the use cases.
6. **Broadcast** — Add `choreLists` to `MapStateBroadcastDto`.
7. **TS types** — Add types and style constants to `types/map.ts`.
8. **Store** — Extend `mapStore.ts` with the chore-list slice and updated `MainView`.
9. **API client** — Add the five functions to `mapApi.ts`.
10. **WebSocket sync** — Update `useMapWebSocket.ts` to extract and store `choreLists` from broadcast.
11. **UI: Overview** — Build `ChoreListsView` with state-count pill cards.
12. **UI: Dialogs** — Build `CreateChoreListDialog` and `EditChoreListDialog`.
13. **UI: Detail + row** — Build `ChoreListDetail` and `ChoreEntryRow` with state selector, assignee popover, and link input.
14. **Navbar + MapPage** — Add Chores nav tab and wire `mainView === 'chores'` render branch.
15. **Docs-site** — Add feature card and use-case entry (§13).
16. **Tests** — Write backend unit tests (§14).

---

## 14. Tests

### 14.1 Use Case Tests — `server/src/test/kotlin/…/application/`

One test class per use case, following the `CreateProcessUseCaseTest` pattern (in-memory ports from `TestPorts.kt`, no Spring context).

| File | Key scenarios |
|------|--------------|
| `CreateChoreListUseCaseTest` | creates list with entries; blank title throws; non-collaborator throws; unknown landmark throws; persists; returns sorted |
| `EditChoreListUseCaseTest` | updates title; adds new landmarks (state=NONE); removes de-selected landmarks; preserves entry state for unchanged; non-collaborator throws |
| `RemoveChoreListUseCaseTest` | removes list; unknown list throws; non-collaborator throws |
| `ToggleChoreListCompletedUseCaseTest` | false→true; true→false; unknown list throws; non-collaborator throws |
| `UpdateChoreEntryUseCaseTest` | sets state; sets assignee (validates collaborator); clears assignee; sets/clears link; sets/clears note; unknown entry throws; non-collaborator assignee throws |
| `ListChoreListsUseCaseTest` | returns all lists sorted by title; viewer (non-collaborator user) can list; unknown map throws |

### 14.2 Persistence Round-Trip — `JsonMapStateRepositoryTest` (new nested class)

Verify that `choreLists` with entries survive a Jackson serialise → write → read → deserialise cycle (adding a `@Nested inner class ChoreListPersistence` to the existing test file).

### 14.3 Frontend Tests — `client/src/test/`

| File | Key scenarios |
|------|--------------|
| `ChoreListsView.test.tsx` | renders overview cards; shows state-count pills; "+ New List" button hidden for viewers; "Open" sets active list |
| `ChoreListDetail.test.tsx` | renders entries sorted by landmark name; Complete / Delete buttons hidden for viewers |
| `CreateChoreListDialog.test.tsx` | submit with blank title disabled; calls `createChoreList` on submit; closes on success |

---

## 13. Docs-Site (GitHub Pages) — `docs-site/src/components/`

### `Benefits.astro`

Add a new feature card at the end of the `features` array:

```ts
{
  icon: '✅',
  title: 'Chore Todo Lists',
  text: 'Create named todo lists scoped to any subset of your landmarks. Each entry tracks a state (None / Ongoing / Blocked / Done), an optional assignee, a reference link, and a free-text note. An overview card shows progress at a glance via colour-coded state counts. Collaborators manage lists; viewers follow along in real time.',
},
```

### `UseCases.astro`

Add a new use-case card at the end of the `cases` array:

```ts
{
  scenario: 'Remediation tracking',
  help: 'Create a Chore List for each sprint or audit cycle — assign landmarks to team members, track Ongoing / Blocked / Done states, and mark the whole list complete when every item is resolved.',
},
```

### Modified Files (docs-site)

| File | Change |
|------|--------|
| `docs-site/src/components/Benefits.astro` | Add Chore Todo Lists feature card |
| `docs-site/src/components/UseCases.astro` | Add Remediation tracking use-case card |


---

## 12. Demo Data — `DemoDataLoader.kt`

Call a new private `createChoreLists()` method at the end of `run()`, after `populateMatrix()`.

### List 1 — "Monthly Infection Control Audit"

Covers all landmarks relevant to infection control. Uses fixed IDs so the loader is idempotent.

| Landmark | State | Assignee | Link | Note |
|----------|-------|----------|------|------|
| Main Entrance | DONE | `nurse-anna` | `https://wiki.internal/infection-control` | Hand-sanitiser refilled and log signed |
| Reception | DONE | `nurse-anna` | | |
| Waiting Room | ONGOING | `nurse-anna` | | Deep-clean scheduled for Friday |
| Examination Room 1 | DONE | `dr-sarah` | | |
| Examination Room 2 | BLOCKED | `dr-james` | | Waiting for replacement UV lamp |
| Surgery Suite | DONE | `dr-sarah` | | |
| Intensive Care Unit | DONE | `dr-james` | | |
| Diagnostic Laboratory | ONGOING | `tech-marc` | | Awaiting new autoclave service report |
| X-Ray Room | DONE | `tech-marc` | | |
| Pharmacy | DONE | `nurse-anna` | | |
| Medical Supply Storage | NONE | | | |
| Kennel | NONE | | | |
| Grooming Station | NONE | | | |

`completed: false`

### List 2 — "Q1 Equipment Uptime Checks"

Covers landmarks with equipment that requires periodic uptime verification. All entries start at NONE so the list demonstrates an unstarted chore list.

| Landmark | State | Assignee | Link | Note |
|----------|-------|----------|------|------|
| Surgery Suite | NONE | `tech-marc` | | |
| Intensive Care Unit | NONE | `tech-marc` | | |
| Diagnostic Laboratory | NONE | `tech-marc` | `https://wiki.internal/lab-equipment` | Centrifuge and analyser |
| X-Ray Room | NONE | `tech-marc` | | |
| Pharmacy | NONE | | | |
| Medical Supply Storage | NONE | `tech-marc` | | Check cold-chain sensor |

`completed: false`

### Implementation in `DemoDataLoader.kt`

Add to constructor injection:
```kotlin
private val createChoreListUseCase: CreateChoreListUseCase,
private val updateChoreEntryUseCase: UpdateChoreEntryUseCase,
private val toggleChoreListCompletedUseCase: ToggleChoreListCompletedUseCase,
```

Add call at the end of `run()`:
```kotlin
createChoreLists()
```

Add private method:
```kotlin
private fun createChoreLists() {
    // List 1 – Monthly Infection Control Audit
    val infectionListId = createChoreListUseCase.execute(
        mapId = DEMO_MAP_ID,
        owner = UN_PETRA,
        title = "Monthly Infection Control Audit",
        landmarkIds = listOf(
            "main-entrance", "reception", "waiting-room",
            "examination-room-1", "examination-room-2",
            "surgery-suite", "intensive-care-unit",
            "diagnostic-laboratory", "x-ray-room",
            "pharmacy", "medical-supply-storage", "kennel", "grooming-station",
        ),
    ).first { it.title == "Monthly Infection Control Audit" }.id

    listOf(
        Triple("main-entrance",          ChoreEntryState.DONE,    USER_NURSE_ANNA),
        Triple("reception",              ChoreEntryState.DONE,    USER_NURSE_ANNA),
        Triple("waiting-room",           ChoreEntryState.ONGOING, USER_NURSE_ANNA),
        Triple("examination-room-1",     ChoreEntryState.DONE,    USER_DR_SARAH),
        Triple("examination-room-2",     ChoreEntryState.BLOCKED, USER_DR_JAMES),
        Triple("surgery-suite",          ChoreEntryState.DONE,    USER_DR_SARAH),
        Triple("intensive-care-unit",    ChoreEntryState.DONE,    USER_DR_JAMES),
        Triple("diagnostic-laboratory",  ChoreEntryState.ONGOING, USER_TECH_MARC),
        Triple("x-ray-room",             ChoreEntryState.DONE,    USER_TECH_MARC),
        Triple("pharmacy",               ChoreEntryState.DONE,    USER_NURSE_ANNA),
    ).forEach { (landmarkId, state, assignee) ->
        updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, landmarkId,
            state = state, assigneeId = assignee, link = null, clearLink = false,
            note = null, clearNote = false)
    }
    // Specific notes
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, "main-entrance",
        note = "Hand-sanitiser refilled and log signed")
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, "waiting-room",
        note = "Deep-clean scheduled for Friday")
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, "examination-room-2",
        note = "Waiting for replacement UV lamp")
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, "diagnostic-laboratory",
        note = "Awaiting new autoclave service report")
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, infectionListId, "main-entrance",
        link = "https://wiki.internal/infection-control")

    // List 2 – Q1 Equipment Uptime Checks
    val uptimeListId = createChoreListUseCase.execute(
        mapId = DEMO_MAP_ID,
        owner = UN_PETRA,
        title = "Q1 Equipment Uptime Checks",
        landmarkIds = listOf(
            "surgery-suite", "intensive-care-unit",
            "diagnostic-laboratory", "x-ray-room",
            "pharmacy", "medical-supply-storage",
        ),
    ).first { it.title == "Q1 Equipment Uptime Checks" }.id

    listOf(
        "surgery-suite", "intensive-care-unit",
        "diagnostic-laboratory", "x-ray-room", "medical-supply-storage",
    ).forEach { landmarkId ->
        updateChoreEntryUseCase.execute(DEMO_MAP_ID, uptimeListId, landmarkId,
            assigneeId = USER_TECH_MARC)
    }
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, uptimeListId, "diagnostic-laboratory",
        link = "https://wiki.internal/lab-equipment", note = "Centrifuge and analyser")
    updateChoreEntryUseCase.execute(DEMO_MAP_ID, uptimeListId, "medical-supply-storage",
        note = "Check cold-chain sensor")
}
```


