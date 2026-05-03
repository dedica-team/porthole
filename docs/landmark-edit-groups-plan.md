# Plan: Landmark Editing, Removal & Groups

## Overview

Extend landmarks with two new fields (`description`, `groupId`), introduce a
`LandmarkGroup` aggregate, wire full edit/remove flows through backend and
frontend, and ensure cascade-deletion of connections on landmark removal
(already implemented – verified in `RemoveLandmarkUseCase`).

---

## 1. Domain – Backend

### 1.1 New `LandmarkGroup` domain class
**File:** `domain/LandmarkGroup.kt` _(new)_

```kotlin
data class LandmarkGroup(
    val id: String,          // UUID
    val name: String,
    val color: String,       // CSS hex string, e.g. "#e74c3c"
)
```

### 1.2 Extend `Landmark`
**File:** `domain/Landmark.kt`

Add two optional fields:
```kotlin
val description: String? = null,
val groupId: String? = null,     // references LandmarkGroup.id
```
`id` stays read-only (derived from `name` at creation time via `toSlug()`).

### 1.3 Extend `MapState`
**File:** `domain/MapState.kt`

Add:
```kotlin
val groups: MutableMap<String, LandmarkGroup> = mutableMapOf(),
```

---

## 2. Application – Backend

### 2.1 Extend `EditLandmarkUseCase`
**File:** `application/EditLandmarkUseCase.kt`

Accept two new optional parameters:
- `description: String?` – trimmed, may be blank to clear it
- `groupId: String?` – validated to exist in `state.groups` or `null` to
  remove group membership

Update `landmark.copy(...)` to include both new fields.

### 2.2 New `CreateGroupUseCase`
**File:** `application/CreateGroupUseCase.kt` _(new)_

```
execute(mapId, name, color): MapState
```
- Validates `name` is non-blank, `color` matches `#[0-9a-fA-F]{6}`.
- Generates a UUID as `id`.
- Adds to `state.groups`, saves, broadcasts.

### 2.3 New `EditGroupUseCase`
**File:** `application/EditGroupUseCase.kt` _(new)_

```
execute(mapId, groupId, name?, color?): MapState
```
- Validates group exists, updates fields, saves, broadcasts.

### 2.4 New `RemoveGroupUseCase`
**File:** `application/RemoveGroupUseCase.kt` _(new)_

```
execute(mapId, groupId): MapState
```
- Removes the group.
- Clears `groupId` on all landmarks that reference it (`landmark.copy(groupId = null)`).
- Saves, broadcasts.

### 2.5 `RemoveLandmarkUseCase` – no changes needed
Connection cascade-deletion is already implemented correctly.

---

## 3. API – Backend

### 3.1 New request/response DTOs
**File:** `adapter/in/web/MapController.kt`

```kotlin
data class EditLandmarkRequest(
    val name: String?,
    val type: String?,
    val description: String?,   // new
    val groupId: String?,       // new – pass null explicitly to unset
)

data class CreateGroupRequest(val name: String, val color: String)
data class EditGroupRequest(val name: String?, val color: String?)
```

### 3.2 New group endpoints in `MapController`

| Method   | Path                                  | Use case             |
|----------|---------------------------------------|----------------------|
| `POST`   | `/api/sessions/{id}/groups`               | `CreateGroupUseCase` |
| `PATCH`  | `/api/sessions/{id}/groups/{groupId}`     | `EditGroupUseCase`   |
| `DELETE` | `/api/sessions/{id}/groups/{groupId}`     | `RemoveGroupUseCase` |

### 3.3 Existing landmark endpoints – only request body changes
`PATCH /api/sessions/{id}/landmarks/{landmarkId}` accepts the extended
`EditLandmarkRequest` with the two new fields.

---

## 4. Persistence – Backend

### 4.1 EclipseStore type dictionary
EclipseStore serialises by type name; adding fields with defaults requires no
migration as long as `LandmarkGroup` is a new class and the new `Landmark`
fields have default values (`null`). The type dictionary
(`PersistenceTypeDictionary.ptd`) will be updated automatically on next boot.

> **Risk:** if existing persisted `Landmark` objects are loaded, EclipseStore
> will fill missing fields with their default values (`null`). No explicit
> migration needed.

---

## 5. Client – Types

### 5.1 `types/map.ts`

```typescript
export interface LandmarkGroup {
  id: string;
  name: string;
  color: string;   // CSS hex, e.g. "#e74c3c"
}

// Extend Landmark
export interface Landmark {
  id: string;
  name: string;
  ownerId: string;
  coordinate: HexCoordinate;
  type: LandmarkType;
  description?: string;       // new
  groupId?: string;           // new
}

// Extend MapState
export interface MapState {
  // ...existing fields...
  groups: Record<string, LandmarkGroup>;   // new
}
```

---

## 6. Client – API (`api/mapApi.ts`)

```typescript
// Extended editLandmark signature
editLandmark(mapId, landmarkId, name?, type?, description?, groupId?)

// New group endpoints
createGroup(mapId, name, color): Promise<MapState>
editGroup(mapId, groupId, name?, color?): Promise<MapState>
removeGroup(mapId, groupId): Promise<MapState>
```

---

## 7. Client – Store (`store/mapStore.ts`)

No structural changes needed. `updateMap` / WS broadcast already replaces the
full `MapState`, so `groups` arrives automatically once the backend sends it.

---

## 8. Client – UI

### 8.1 `LandmarkPanel.tsx` – edit form extensions

The existing edit form (name + type selector) gains two new fields:

- **Description** – `<textarea>` or multi-line `<Input>`, optional, max 280
  chars.
- **Group** – `<select>` populated from `currentMap.groups`.  
  Options: "— No group —" + one entry per group (coloured dot + name).  
  The landmark's current group is pre-selected.

The **ID field** remains display-only (read-only `<span>`), clearly labelled
"ID (not editable)".

### 8.2 New `GroupsPanel.tsx` _(new sidebar panel or section in EditorPanel)_

A small panel (reachable via a "Groups" button in the editor or a dedicated
sidebar panel `'groups'`) with:

- List of existing groups (coloured dot, name, edit/delete buttons).
- "Add Group" form: name input + colour picker (simple `<input type="color">`).
- Inline editing of name and colour.
- Delete shows a warning if landmarks are still assigned to the group.

### 8.3 `SidebarPanel` type extension
**File:** `store/mapStore.ts`

```typescript
export type SidebarPanel = 'idle' | 'tile' | 'landmark' | 'editor' | 'groups';
```

### 8.4 `IdlePanel.tsx` / `Sidebar.tsx`

Add a "Groups" entry point (button or nav item) that switches to the new
`'groups'` panel.

---

## 9. Tests

### 9.1 Backend

| File | New tests |
|------|-----------|
| `EditLandmarkUseCaseTest.kt` | editing `description` and `groupId`; invalid `groupId` rejected |
| `CreateGroupUseCaseTest.kt` _(new)_ | happy path; invalid colour; duplicate id |
| `EditGroupUseCaseTest.kt` _(new)_ | name/colour update; group not found |
| `RemoveGroupUseCaseTest.kt` _(new)_ | group removed; `groupId` cleared on affected landmarks |

### 9.2 Frontend

| File | New tests |
|------|-----------|
| `MapPage.test.tsx` | `editLandmark` called with `description`; group select visible in edit mode |
| `LandmarkPanel.test.tsx` _(new)_ | description field present; ID field read-only; group dropdown populated |
| `GroupsPanel.test.tsx` _(new)_ | create/edit/delete group; warning when landmarks assigned |

---

## 10. Implementation Order

1. Domain: `LandmarkGroup`, extend `Landmark`, extend `MapState`.
2. Application: extend `EditLandmarkUseCase`; add three group use cases.
3. API: DTOs + controller endpoints.
4. Persistence: verify EclipseStore boots cleanly with the new types.
5. Client types + API layer.
6. UI: extend `LandmarkPanel` edit form → `GroupsPanel`.
7. Tests (backend then frontend).

