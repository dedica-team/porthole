# Greenkeeping Rotation View Plan

> **Status:** Draft
> **Scope:** Per-map greenkeeping rotations. Each rotation contains a name, an optional description, an optional link, a set of groups, and an ordered sequence of collaborators. Groups and collaborator entries can be added, edited, and removed. Collaborator order can be changed. Exactly one collaborator is active at a time. Marking the active collaborator as done advances the rotation; when the last collaborator is completed, the rotation resets to all-undone and starts again from the first collaborator.

---

## 1. Goal

The Greenkeeping Rotation view should make recurring ownership transparent for a selected set of map groups.

A rotation answers three questions at a glance:

1. **Which groups are covered?**
2. **Who is currently on duty?**
3. **Who is next in line?**

The feature is intended for lightweight operational stewardship, not ticket tracking:

- a rotation belongs to a map
- a rotation references one or more existing map groups
- a rotation contains an ordered list of existing map collaborators
- the active collaborator is the first collaborator in the sequence whose `done` flag is `false`
- when the active collaborator is marked done, the next collaborator becomes active
- when the last collaborator is marked done, the cycle automatically resets and starts over from the first collaborator

---

## 2. Product Behaviour

### 2.1 Core user flows

#### Create a rotation
A collaborator can create a named rotation and configure:

- a title
- an optional description
- an optional link
- a set of groups from the current map
- an ordered list of collaborators from the current map

#### Edit a rotation
A collaborator can:

- rename the rotation
- change the description
- add, change, or clear the link
- add or remove groups
- replace a collaborator entry with another collaborator
- remove collaborator entries
- reorder collaborator entries

#### Delete a rotation
A collaborator can delete a rotation after confirmation.

#### Advance the rotation
A collaborator can press **Mark active done**.

System behaviour:

- the current active collaborator is marked `done = true`
- if another not-done collaborator exists after that entry, that next collaborator becomes active
- if the completed collaborator was the final remaining not-done entry, the system resets all entries to `done = false`
- after reset, the first collaborator in the ordered sequence becomes active again

### 2.2 Read-only behaviour

Viewers can:

- see the list of rotations
- open rotation details
- see covered groups, current active collaborator, and queue order

Viewers cannot:

- create rotations
- edit or delete rotations
- reorder collaborators
- mark the active collaborator done

---

## 3. Data Model

### 3.1 Frontend types — `client/src/types/map.ts`

Add the following types:

These frontend IDs remain `string`, because they represent the JSON-serialised form of backend UUIDs.

```ts
export interface GreenkeepingRotationCollaborator {
  id: string;
  collaboratorId: string;
  done: boolean;
}

export interface GreenkeepingRotation {
  id: string;
  name: string;
  description?: string;
  link?: string;
  groupIds: string[];
  collaborators: GreenkeepingRotationCollaborator[];
  updatedAt?: string;
  updatedBy?: string;
}
```

### 3.2 Derived frontend helpers

Add pure helpers near the types or in a small utility file:

```ts
export function getActiveGreenkeepingEntry(rotation: GreenkeepingRotation): GreenkeepingRotationCollaborator | null
export function isGreenkeepingRotationComplete(rotation: GreenkeepingRotation): boolean
export function getGreenkeepingProgress(rotation: GreenkeepingRotation): { done: number; total: number }
```

**Important design choice:** do **not** persist `activeCollaboratorId` separately.

The active collaborator is derived from the first collaborator entry where `done === false`.

This avoids invalid state such as:

- no active collaborator although unfinished entries exist
- two active collaborators
- stale active pointer after reordering or deletion

### 3.3 Backend Kotlin domain — `server/src/main/kotlin/.../domain/`

**New file: `GreenkeepingRotationCollaborator.kt`**

```kotlin
package team.dedica.porthole.domain

import java.util.UUID

data class GreenkeepingRotationCollaborator(
    val id: UUID = UUID.randomUUID(),
    var collaboratorId: UUID,
    var done: Boolean = false,
)
```

**New file: `GreenkeepingRotation.kt`**

```kotlin
package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

data class GreenkeepingRotation(
    val id: UUID = UUID.randomUUID(),
    var name: String,
    var description: String? = null,
    var link: String? = null,
    val groupIds: MutableList<UUID> = mutableListOf(),
    val collaborators: MutableList<GreenkeepingRotationCollaborator> = mutableListOf(),
    var updatedAt: Instant = Instant.now(),
    var updatedBy: UUID? = null,
)
```

**Modify `MapState.kt`**

```kotlin
val greenkeepingRotations: MutableMap<UUID, GreenkeepingRotation> = mutableMapOf()
```

Backend-intern, the Kotlin model should use real `UUID` values throughout. Over REST/JSON these UUIDs are still exchanged as strings and therefore remain `string` in TypeScript.

---

## 4. Domain Rules and Validation

### 4.1 Rotation-level validation

A rotation must satisfy:

- `name` is non-blank
- `groupIds` contains no duplicates
- `collaborators` contains no duplicate `collaboratorId` values
- `description`, if set, is optional free text
- `link`, if set, must be a valid `http` or `https` URL
- every `groupId: UUID` refers to an existing map group
- every `collaboratorId: UUID` refers to an existing map collaborator
- a new or updated rotation must contain at least **one** group
- a new or updated rotation must contain at least **one** collaborator

Link handling should follow the same sanitising rules as other optional links in the system: trim whitespace, treat blank values as unset, and reject invalid or non-HTTP(S) URLs.

### 4.2 Sequence invariants

- collaborator order is the list order
- the active collaborator is the first collaborator with `done == false`
- zero or more collaborators may be marked done
- all done entries must remain in-place; they are not moved automatically
- once all entries are done, the next advance resets the full list to undone in the same order

### 4.3 Reorder behaviour

When collaborators are reordered:

- done flags stay attached to their collaborator entries
- active collaborator is recalculated from the new order
- if all entries are done, the rotation remains complete until the next advance triggers reset

### 4.4 Deletion behaviour

If a collaborator entry is deleted:

- remove only that sequence entry
- recompute active collaborator from the remaining ordered entries
- if the list becomes empty, the rotation becomes invalid for saving; the UI should prevent this during normal editing

If a referenced map collaborator is removed from the map:

- all matching rotation collaborator entries must be removed automatically
- affected rotations are persisted and broadcast

If a referenced group is removed from the map:

- that `groupId` must be removed from all rotations automatically
- if a rotation ends up with zero groups, it remains visible but is flagged as incomplete until edited

---

## 5. Backend REST API

**New controller:** `GreenkeepingRotationController.kt`

Base path: `/api/sessions/{id}/greenkeeping-rotations`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List all rotations for the map | Collaborator or viewer |
| `POST` | `/` | Create a rotation | Collaborator only |
| `PATCH` | `/{rotationId}` | Edit name, description, link, groups, and/or collaborator sequence | Collaborator only |
| `DELETE` | `/{rotationId}` | Delete a rotation | Collaborator only |
| `POST` | `/{rotationId}/advance` | Mark active collaborator done and advance/reset cycle | Collaborator only |

### 5.1 DTO additions — `adapter/in/web/dto/MapRequestDtos.kt`

```kotlin
data class GreenkeepingRotationCollaboratorRequest(
    val id: UUID? = null,
    val collaboratorId: UUID,
    val done: Boolean = false,
)

data class CreateGreenkeepingRotationRequest(
    @field:NotBlank val name: String,
    val description: String? = null,
    val link: String? = null,
    val groupIds: List<UUID> = emptyList(),
    val collaborators: List<GreenkeepingRotationCollaboratorRequest> = emptyList(),
)

data class EditGreenkeepingRotationRequest(
    val name: String? = null,
    val description: String? = null,
    val clearDescription: Boolean = false,
    val link: String? = null,
    val clearLink: Boolean = false,
    val groupIds: List<UUID>? = null,
    val collaborators: List<GreenkeepingRotationCollaboratorRequest>? = null,
)
```

At the HTTP boundary, these UUID values are still sent as standard JSON UUID strings.

### 5.2 Endpoint notes

- All write endpoints resolve the caller and require collaborator permissions.
- `PATCH /{rotationId}` accepts the **full ordered collaborator list** so reorder operations remain simple and deterministic.
- `POST /{rotationId}/advance` contains no request body.
- `GET /` returns rotations sorted by name.
- Controller path parameters such as `{id}` and `{rotationId}` should be handled as `UUID` values on the Kotlin side.

---

## 6. Backend Use Cases — `application/session/greenkeeping/`

| File | Responsibility |
|------|---------------|
| `ListGreenkeepingRotationsUseCase.kt` | Returns all map rotations sorted by name |
| `CreateGreenkeepingRotationUseCase.kt` | Validates references, optional description/link, and creates a rotation |
| `EditGreenkeepingRotationUseCase.kt` | Updates name/description/link/groupIds/collaborator order and preserves valid `done` states |
| `RemoveGreenkeepingRotationUseCase.kt` | Deletes a rotation |
| `AdvanceGreenkeepingRotationUseCase.kt` | Marks the active collaborator done; if all are done afterwards, resets all to undone |
| `RemoveCollaboratorFromGreenkeepingRotationsUseCase.kt` | Cleans up all rotation entries for a removed map collaborator |
| `RemoveGroupFromGreenkeepingRotationsUseCase.kt` | Cleans up deleted map groups from rotations |

### 6.1 Advance algorithm

`AdvanceGreenkeepingRotationUseCase` should work as follows:

1. load map and rotation
2. require collaborator permission
3. find first collaborator entry with `done == false`
4. if none exists:
   - reset all entries to `done = false`
   - treat the first entry as active
5. mark the active entry as `done = true`
6. if all entries are now done:
   - reset all entries to `done = false`
7. update `updatedAt` and `updatedBy`
8. persist and broadcast

This produces the required behaviour:

- active collaborator advances one step at a time
- finishing the last entry restarts the cycle immediately

### 6.2 Edit semantics

When a rotation is edited with a new collaborator list:

- existing entry IDs may be reused to preserve `done` state for unchanged entries
- newly added entries receive fresh IDs and default to `done = false`
- removed entries disappear completely
- `link` may be added, replaced, or cleared independently of `description`
- duplicate collaborators are rejected

All Greenkeeping use cases should accept Kotlin `UUID` parameters for map IDs, rotation IDs, group IDs, collaborator IDs, and acting user IDs where applicable.

---

## 7. Persistence and Broadcast

### 7.1 Persistence

`greenkeepingRotations` is stored inside `MapState` like other collaborative map state.

No special serializer is needed if the project already persists nested maps and lists via Jackson / EclipseStore.

### 7.2 WebSocket / real-time sync

**Design choice:** include `greenkeepingRotations` in the map broadcast payload.

This keeps the feature live-updated for:

- creation
- edits
- delete
- reorder
- advance/reset
- cleanup after group or collaborator removal

**`MapStateBroadcastDto.kt`**

Add:

```kotlin
val greenkeepingRotations: Map<UUID, GreenkeepingRotation> = emptyMap()
```

and populate it in `from(state)`.

**`client/src/hooks/useMapWebSocket.ts`**

Parse `greenkeepingRotations` before or alongside the existing map update flow and store them in the dedicated store slice.

---

## 8. Frontend Store — `client/src/store/mapStore.ts`

### 8.1 Extend `MainView`

```ts
export type MainView = 'idle' | 'tile' | 'landmark' | 'editor' | 'groups'
                     | 'metrics' | 'matrix' | 'process' | 'chores' | 'greenkeeping';
```

### 8.2 Add store slice

```ts
greenkeepingRotations: GreenkeepingRotation[];
greenkeepingRotationsFetched: boolean;
greenkeepingRotationsLoading: boolean;
greenkeepingRotationsError: string | null;
activeGreenkeepingRotationId: string | null;

setGreenkeepingRotations: (rotations: GreenkeepingRotation[]) => void;
setGreenkeepingRotationsFetched: (value: boolean) => void;
setGreenkeepingRotationsLoading: (value: boolean) => void;
setGreenkeepingRotationsError: (value: string | null) => void;
setActiveGreenkeepingRotationId: (id: string | null) => void;
```

### 8.3 Reset on map switch

In `setCurrentMap`, reset the full greenkeeping slice, matching the existing view-specific slices.

---

## 9. API Client — `client/src/api/mapApi.ts`

Add functions:

```ts
export async function fetchGreenkeepingRotations(mapId: string): Promise<GreenkeepingRotation[]>
export async function createGreenkeepingRotation(mapId: string, payload: CreateGreenkeepingRotationPayload): Promise<GreenkeepingRotation[]>
export async function editGreenkeepingRotation(mapId: string, rotationId: string, patch: EditGreenkeepingRotationPayload): Promise<GreenkeepingRotation[]>
export async function deleteGreenkeepingRotation(mapId: string, rotationId: string): Promise<void>
export async function advanceGreenkeepingRotation(mapId: string, rotationId: string): Promise<GreenkeepingRotation>
```

`deleteGreenkeepingRotation` should use a `204 No Content` response without body parsing.

---

## 10. UI Components

### 10.1 `GreenkeepingRotationsView` — `client/src/components/GreenkeepingRotationsView/GreenkeepingRotationsView.tsx`

Top-level view rendered when `mainView === 'greenkeeping'`.

#### Overview layout

Show a scrollable list of rotation cards.

Each card displays:

- rotation name
- optional description
- optional link (preferably as compact external-link action, not a full raw URL)
- covered groups as chips
- active collaborator prominently highlighted
- progress summary, e.g. `2 / 5 done`
- next collaborators in order
- action buttons: **Open**, **Advance**, **Edit**, **Delete**

Collaborator-only toolbar:

- `+ Rotation`

Viewer behaviour:

- cards are visible
- edit/create/delete/advance buttons are hidden or disabled

Empty state:

- friendly icon and message
- CTA button for collaborators: `+ Add first rotation`

### 10.2 `GreenkeepingRotationDetail` — `client/src/components/GreenkeepingRotationsView/GreenkeepingRotationDetail.tsx`

Detail panel or full-page detail view for one selected rotation.

Suggested sections:

1. **Header**
   - back button
   - name
   - description
   - optional clickable link
   - edit/delete buttons
2. **Groups**
   - chips or compact list of referenced groups
3. **Rotation Queue**
   - one row per collaborator entry in order
   - active row highlighted
   - done rows show success styling
   - remaining rows shown as upcoming
4. **Primary action**
   - `Mark active done`
   - optional helper text: `Next: <name>`

### 10.3 `CreateEditGreenkeepingRotationDialog` — `client/src/components/GreenkeepingRotationsView/CreateEditGreenkeepingRotationDialog.tsx`

Single reusable dialog for create and edit.

Fields:

- `name` input
- `description` textarea
- `link` input
- multi-select list of map groups
- ordered collaborator editor

Ordered collaborator editor requirements:

- add collaborator from map collaborator list
- edit an existing entry by replacing the selected collaborator
- remove an entry
- move entry up/down
- prevent duplicate collaborator selection
- show inline validation errors

**Implementation note:** start with explicit **Move up / Move down** controls. Drag-and-drop can be a later enhancement.

### 10.4 `GreenkeepingRotationCollaboratorRow` — optional helper component

Encapsulates one row in the collaborator editor and/or detail queue.

---

## 11. UI / UX Details

### 11.1 Visual states

For each collaborator row:

- **Active** — highlighted border/background, badge `Active`
- **Done** — green badge or check icon
- **Upcoming** — neutral styling

### 11.2 Rotation summary on cards

Each overview card should show:

- active collaborator avatar + name
- total collaborators
- done count
- covered group count
- optional external-link icon when the rotation has a link

### 11.3 Reset feedback

When advancing the last collaborator in the sequence:

- the UI should immediately show the reset state after the server response
- optional toast: `Rotation completed — starting next cycle`

### 11.4 Accessibility

- all reorder controls keyboard accessible
- active state not only colour-based; also label or icon
- destructive actions require confirmation
- lists remain understandable for screen readers with ordinal labels such as `1st`, `2nd`, `3rd`

---

## 12. Navbar and MapPage Integration

### 12.1 Navbar — `client/src/components/Navbar/Navbar.tsx`

Add a new view-switcher tab, similar to `Metrics`, `Matrix`, or `Chores`.

Suggested label:

- `Greenkeeping`

Suggested icon:

- `Repeat`
- or `RefreshCcw`
- or `UsersRound`

### 12.2 MapPage — `client/src/pages/MapPage/MapPage.tsx`

Add a new render branch:

```tsx
} : mainView === 'greenkeeping' ? (
  <GreenkeepingRotationsView />
) : ...
```

Hide the map sidebar for the dedicated greenkeeping view in the same way as for other full-page management views.

---

## 13. Edge Cases

### 13.1 Rotation with one collaborator

Behaviour:

- that collaborator is always the active one
- marking done resets immediately back to undone
- the collaborator becomes active again

### 13.2 Editing a rotation while some collaborators are already done

Allowed, but rules apply:

- unchanged collaborator entries may keep their `done` state
- new collaborator entries start undone
- removed collaborator entries disappear
- active collaborator is recalculated after save

### 13.3 Reordering while partially completed

Example:

- A done
- B active
- C upcoming

If reordered to `C, A, B`, the new active collaborator becomes the first not-done entry in the new order.

### 13.4 Duplicate collaborators

Not allowed.

Reason:

- it makes the active cycle ambiguous to users
- it complicates reporting and editing
- it is unlikely to be intended

### 13.5 Empty groups after cleanup

If all referenced groups are deleted from the map:

- keep the rotation record
- show warning text in the UI: `No groups assigned`
- disable saving unchanged invalid state only if the user edits the rotation

### 13.6 Empty collaborator list after cleanup

If all referenced collaborators are removed from the map:

- keep the rotation record
- show warning text: `No collaborators assigned`
- disable advance action
- prompt the next editor to repair the rotation

---

## 14. Tests

### 14.1 Backend use-case tests — `server/src/test/kotlin/.../application/`

| File | Key scenarios |
|------|---------------|
| `CreateGreenkeepingRotationUseCaseTest` | creates valid rotation; persists optional description/link; blank name rejected; invalid link rejected; unknown group rejected; unknown collaborator rejected; duplicate group rejected; duplicate collaborator rejected |
| `EditGreenkeepingRotationUseCaseTest` | renames; clears description; adds/replaces/clears link; replaces groups; reorders collaborators; preserves done state for unchanged entries; rejects duplicates |
| `RemoveGreenkeepingRotationUseCaseTest` | deletes existing rotation; unknown rotation throws; non-collaborator rejected |
| `AdvanceGreenkeepingRotationUseCaseTest` | marks first active done; advances to next; completing last collaborator resets all to undone; one-collaborator case resets correctly |
| `ListGreenkeepingRotationsUseCaseTest` | returns all rotations sorted by name; viewer can read |
| `RemoveCollaboratorFromGreenkeepingRotationsUseCaseTest` | removes collaborator from all rotations and keeps order of remaining entries |
| `RemoveGroupFromGreenkeepingRotationsUseCaseTest` | removes deleted group IDs from all rotations |

### 14.2 API tests

Add controller tests for:

- `GET /greenkeeping-rotations`
- `POST /greenkeeping-rotations`
- `PATCH /greenkeeping-rotations/{id}`
- `DELETE /greenkeeping-rotations/{id}`
- `POST /greenkeeping-rotations/{id}/advance`

Verify:

- collaborator permissions
- validation errors
- correct reset behaviour on final advance

### 14.3 Frontend tests — `client/src/test/`

| File | Key scenarios |
|------|---------------|
| `GreenkeepingRotationsView.test.tsx` | renders cards; shows empty state; create button hidden for viewers |
| `GreenkeepingRotationDetail.test.tsx` | shows groups, description, and optional link; shows active collaborator; advance button triggers API call; final advance resets UI state |
| `CreateEditGreenkeepingRotationDialog.test.tsx` | validates name/groups/collaborators; validates optional HTTP(S) link; prevents duplicates; reorder buttons update order |

---

## 15. File Structure

### New backend files

```text
server/src/main/kotlin/.../domain/
  GreenkeepingRotation.kt
  GreenkeepingRotationCollaborator.kt

server/src/main/kotlin/.../application/session/greenkeeping/
  ListGreenkeepingRotationsUseCase.kt
  CreateGreenkeepingRotationUseCase.kt
  EditGreenkeepingRotationUseCase.kt
  RemoveGreenkeepingRotationUseCase.kt
  AdvanceGreenkeepingRotationUseCase.kt
  RemoveCollaboratorFromGreenkeepingRotationsUseCase.kt
  RemoveGroupFromGreenkeepingRotationsUseCase.kt

server/src/main/kotlin/.../adapter/in/web/
  GreenkeepingRotationController.kt
```

### New frontend files

```text
client/src/components/GreenkeepingRotationsView/
  GreenkeepingRotationsView.tsx
  GreenkeepingRotationDetail.tsx
  CreateEditGreenkeepingRotationDialog.tsx
  GreenkeepingRotationCollaboratorRow.tsx
```

### Modified files

| File | Change summary |
|------|----------------|
| `server/.../domain/MapState.kt` | add `greenkeepingRotations: MutableMap<UUID, GreenkeepingRotation>` |
| `server/.../adapter/in/web/dto/MapRequestDtos.kt` | add rotation DTOs using Kotlin `UUID` fields |
| `server/.../adapter/out/messaging/MapStateBroadcastDto.kt` | add `greenkeepingRotations: Map<UUID, GreenkeepingRotation>` |
| `client/src/types/map.ts` | add greenkeeping types, including optional description/link, and helpers using stringified UUIDs on the frontend |
| `client/src/store/mapStore.ts` | add greenkeeping slice and `MainView` value |
| `client/src/api/mapApi.ts` | add greenkeeping API calls including optional link fields |
| `client/src/hooks/useMapWebSocket.ts` | parse/store greenkeeping updates |
| `client/src/components/Navbar/Navbar.tsx` | add Greenkeeping tab |
| `client/src/pages/MapPage/MapPage.tsx` | render `GreenkeepingRotationsView` |

---

## 16. Implementation Order

1. Add domain classes and `MapState` field
2. Add DTOs and REST controller
3. Implement create/list/edit/delete/advance use cases
4. Add cleanup hooks for map collaborator and group deletion flows
5. Add broadcast support
6. Add frontend types and helper functions
7. Add store slice and API client functions
8. Build overview view
9. Build create/edit dialog with ordered collaborator editor
10. Build detail view and advance action
11. Integrate navbar and `MapPage`
12. Add backend and frontend tests

---

## 17. Open Questions

1. Should a rotation allow **zero groups** as a draft state, or should at least one group always be required?
2. Should the UI support **drag-and-drop reorder** immediately, or are explicit up/down buttons sufficient for V1?
3. Should the system record **rotation history** such as `lastCompletedAt`, `completedCycleCount`, or `completedBy`?
4. Should viewers be allowed to see the **advance button disabled**, or should it be hidden entirely?
5. Should the overview support **filtering by group** or **only rotations containing the currently selected map group**?
6. If a collaborator is removed from the map and a rotation becomes empty, should the system keep it as repairable draft data or auto-delete it?

---

## 18. Recommended V1 Decisions

To keep the initial implementation focused:

- require at least **one group** and **one collaborator** on save
- disallow duplicate collaborators in a rotation
- use **up/down reorder buttons** instead of drag-and-drop
- derive the active collaborator instead of storing it explicitly
- reset the cycle **immediately** when the last collaborator is marked done
- keep invalid rotations after external cleanup, but clearly flag them in the UI

These decisions minimise state complexity while still delivering the full required behaviour.

