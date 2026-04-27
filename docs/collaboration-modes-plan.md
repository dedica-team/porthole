# Collaboration Modes – Implementation Plan

## Overview

Three collaboration modes control who can view and edit a map session:

| Mode | View | Edit |
|---|---|---|
| `OPEN` (default) | anyone authenticated | anyone authenticated (auto-joins on first edit) |
| `REQUEST` | anyone authenticated | collaborators only; others submit a join request |
| `PRIVATE` | collaborators only | collaborators only; others submit a join request |

Join requests are visible in the Navbar map dropdown so that any existing collaborator can act on them.

---

## 1. Domain Layer

### 1.1 New enum `CollaborationMode`

**File:** `domain/CollaborationMode.kt`

```kotlin
enum class CollaborationMode { OPEN, REQUEST, PRIVATE }
```

### 1.2 New domain class `JoinRequest`

**File:** `domain/JoinRequest.kt`

```kotlin
data class JoinRequest(
    val id: String = UUID.randomUUID().toString(),
    val userId: String,
    val username: String,
    val avatarUrl: String? = null,
    val requestedAt: Instant = Instant.now(),
)
```

Represents a pending request from a non-collaborator to become a collaborator.

### 1.3 Extend `MapState`

**File:** `domain/MapState.kt`

Add two fields:

```kotlin
val collaborationMode: CollaborationMode = CollaborationMode.OPEN,
val joinRequests: MutableList<JoinRequest> = mutableListOf(),
```

Add helper methods:

```kotlin
fun isCollaborator(userId: String): Boolean =
    collaborators.any { it.id == userId }

fun hasPendingRequest(userId: String): Boolean =
    joinRequests.any { it.userId == userId }
```

---

## 2. Application Layer

### 2.1 `SetCollaborationModeUseCase` (new)

**File:** `application/SetCollaborationModeUseCase.kt`

- Parameters: `mapId`, `requestingUsername`, `mode: CollaborationMode`
- Guards: map must exist; requesting user must be a collaborator
- Sets `collaborationMode` on the state, broadcasts

### 2.2 `RequestJoinUseCase` (new)

**File:** `application/RequestJoinUseCase.kt`

- Parameters: `mapId`, `requestingUsername`
- Guards: map must exist; mode must be `REQUEST` or `PRIVATE`; user must **not** already be a collaborator; no duplicate pending request from the same user
- Appends a `JoinRequest` to `state.joinRequests`, broadcasts

### 2.3 `AcceptJoinRequestUseCase` (new)

**File:** `application/AcceptJoinRequestUseCase.kt`

- Parameters: `mapId`, `requestingUsername` (the acceptor), `requestId`
- Guards: map must exist; accepting user must be a collaborator; request with `requestId` must exist
- Removes the `JoinRequest` from the list; adds the requester as a `Collaborator`; broadcasts

### 2.4 `DeclineJoinRequestUseCase` (new)

**File:** `application/DeclineJoinRequestUseCase.kt`

- Parameters: `mapId`, `requestingUsername` (the decliner), `requestId`
- Guards: map must exist; declining user must be a collaborator; request with `requestId` must exist
- Removes the `JoinRequest` from the list; broadcasts

### 2.5 Modify `JoinMapUseCase`

- In `OPEN` mode: behaviour unchanged (immediately adds collaborator)
- In `REQUEST` / `PRIVATE` mode: throw `IllegalStateException("Join requests required for this map")` so that the client knows it should call the request endpoint instead

### 2.6 Modify `GetMapUseCase`

- If the map's mode is `PRIVATE` and the requesting user is **not** a collaborator: throw `AccessDeniedException("Map is private")` (results in 403)
- The `GET /api/maps` list endpoint: filter out `PRIVATE` maps for which the caller is not a collaborator

### 2.7 Add collaborator guard helper

**File:** `application/AuthorizationUtils.kt` (or inline in each use case)

```kotlin
fun MapState.requireCollaborator(userId: String) =
    require(isCollaborator(userId)) { "User $userId is not a collaborator on map $id" }
```

Apply this guard in every mutating use case (PlaceLandmark, EditLandmark, RemoveLandmark, CreateConnection, EditConnection, RemoveConnection, CreateGroup, EditGroup, RemoveGroup, CreateMetric, EditMetric, RemoveMetric, SetLandmarkMetric, ClearLandmarkMetric, EditTile, EditMap). Currently these use cases do **not** check whether the acting user is a collaborator at all.

---

## 3. Web Adapter Layer

### 3.1 New DTO

**File:** `adapter/in/web/dto/MapRequestDtos.kt` – add:

```kotlin
data class SetCollaborationModeRequest(val mode: String)  // "OPEN" | "REQUEST" | "PRIVATE"
```

### 3.2 New endpoints on `MapController`

```
PATCH /api/maps/{id}/collaboration-mode
    Body: { "mode": "REQUEST" }
    Auth: must be collaborator
    → 200 MapState | 400 unknown mode | 403 not a collaborator

POST  /api/maps/{id}/join-requests
    (replaces current POST /{id}/join behaviour for REQUEST/PRIVATE maps)
    Auth: authenticated user who is not yet a collaborator
    → 200 MapState | 409 request already pending | 422 already a collaborator

POST  /api/maps/{id}/join-requests/{requestId}/accept
    Auth: must be collaborator
    → 200 MapState | 403 | 404 request not found

POST  /api/maps/{id}/join-requests/{requestId}/decline
    Auth: must be collaborator
    → 200 MapState | 403 | 404 request not found
```

Keep `POST /api/maps/{id}/join` but let it route through `JoinMapUseCase` which now throws for non-OPEN maps, so the client can detect the mode and show the request button instead.

### 3.3 Modify `MapController.getMap` / `listMaps`

- Inject the authenticated user principal into `GET /api/maps/{id}` and `GET /api/maps` and pass it to the use cases for the visibility check.  
- `GET /api/maps/{id}` for an unauthenticated user on a PRIVATE map → 403.  
- `GET /api/maps` filters PRIVATE maps to only those where the caller is a collaborator.

---

## 4. Frontend (TypeScript / React)

### 4.1 Type changes – `src/types/map.ts`

```ts
export type CollaborationMode = 'OPEN' | 'REQUEST' | 'PRIVATE';

export interface JoinRequest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  requestedAt: string;
}

// extend MapState
export interface MapState {
  // ...existing fields...
  collaborationMode: CollaborationMode;   // default: 'OPEN'
  joinRequests: JoinRequest[];
}
```

### 4.2 API functions – `src/api/mapApi.ts`

```ts
setCollaborationMode(mapId, mode): Promise<MapState>
requestJoin(mapId): Promise<MapState>
acceptJoinRequest(mapId, requestId): Promise<MapState>
declineJoinRequest(mapId, requestId): Promise<MapState>
```

### 4.3 Lobby page

- Show the collaboration mode badge next to each map in the list (lock icon for PRIVATE, envelope icon for REQUEST, globe icon for OPEN).
- `Join` button:
  - OPEN → calls existing `joinMap()`, navigates to map.
  - REQUEST / PRIVATE → calls `requestJoin()`, shows "Request sent" state.
  - Already a collaborator → "Open" button, no join/request.
- PRIVATE maps only appear in the list for collaborators.

### 4.4 Map settings (Navbar)

- Add a "Collaboration" section in the map name/description popover (or a dedicated settings panel).
- A `<select>` with the three modes, only visible/enabled for collaborators.
- On change: calls `setCollaborationMode()`.

### 4.5 Navbar map dropdown – open join requests

- In the map dropdown (or a dedicated bell/badge icon), show a list of pending `joinRequests` for the current map.
- Each entry shows the requester's avatar + username + "Accept" / "Decline" buttons.
- The number of pending requests is shown as a badge on the dropdown trigger.
- Only rendered for collaborators.

### 4.6 `MapPage` – edit guard

- If `collaborationMode !== 'OPEN'` and the current user is not a collaborator, put the page into read-only mode: hide all edit controls (landmark placement, tile editor, metric editing, etc.).
- If the user is also not in the collaborators list for a PRIVATE map, redirect to lobby with an error message (the server will already have returned 403 on load).

---

## 5. Backend API Tests

All new tests go into `MapControllerTest.kt` or a new `CollaborationControllerTest.kt`. Tests use the existing `@SpringBootTest` + `MockMvc` + `JwtTokenProvider` pattern. A second user (`otheruser` / `other-uid-002`) is set up in `@BeforeEach`.

### 5.1 `CollaborationModeTests` group

```
PATCH collaboration-mode as collaborator sets mode → 200, body contains new mode
PATCH collaboration-mode with unknown value → 400
PATCH collaboration-mode as non-collaborator → 403
```

### 5.2 `JoinRequestTests` group – REQUEST mode

```
POST join on OPEN map adds collaborator immediately → 200
POST join on REQUEST map returns error (use join-requests instead) → 422

POST join-requests by non-collaborator on REQUEST map → 200, request appears in joinRequests list
POST join-requests when already a collaborator → 422
POST join-requests when request already pending → 409

POST join-requests/{id}/accept as collaborator → 200, user now in collaborators, request gone
POST join-requests/{id}/accept as non-collaborator → 403
POST join-requests/{id}/accept with unknown requestId → 404

POST join-requests/{id}/decline as collaborator → 200, request gone, user NOT in collaborators
POST join-requests/{id}/decline as non-collaborator → 403
POST join-requests/{id}/decline with unknown requestId → 404
```

### 5.3 `PrivateModeTests` group

```
GET map/{id} on PRIVATE map as non-collaborator → 403
GET map/{id} on PRIVATE map as collaborator → 200
GET maps list as non-collaborator hides PRIVATE maps → 200, PRIVATE map not in list
GET maps list as collaborator shows own PRIVATE map → 200, PRIVATE map in list
```

### 5.4 `CollaboratorEditGuardTests` group

These tests verify the new collaborator guard added in step 2.7. For each mutating endpoint, send a request from `otheruser` who is **not** a collaborator and assert 403:

```
POST  /api/maps/{id}/landmarks            → 403 for non-collaborator
DELETE /api/maps/{id}/landmarks/{lmId}   → 403 for non-collaborator
PATCH  /api/maps/{id}/landmarks/{lmId}   → 403 for non-collaborator
PATCH  /api/maps/{id}/tiles/{q}/{r}      → 403 for non-collaborator
POST   /api/maps/{id}/groups             → 403 for non-collaborator
PATCH  /api/maps/{id}/groups/{gId}       → 403 for non-collaborator
DELETE /api/maps/{id}/groups/{gId}       → 403 for non-collaborator
POST   /api/maps/{id}/metrics            → 403 for non-collaborator
PATCH  /api/maps/{id}/metrics/{mId}      → 403 for non-collaborator
DELETE /api/maps/{id}/metrics/{mId}      → 403 for non-collaborator
PUT    /api/maps/{id}/landmarks/{lmId}/metrics/{mId} → 403 for non-collaborator
DELETE /api/maps/{id}/landmarks/{lmId}/metrics/{mId} → 403 for non-collaborator
PATCH  /api/maps/{id}                    → 403 for non-collaborator
```

---

## 6. WebSocket / Broadcast

- The `joinRequests` list is part of `MapState` and will therefore automatically be included in every WebSocket broadcast.
- No structural WebSocket changes needed.
- Clients receive live updates when a request is submitted, accepted, or declined.

---

## 7. Data Migration / Persistence

- `collaborationMode` defaults to `OPEN` so all existing persisted `MapState` JSON files deserialise without change (Jackson uses the field default).
- `joinRequests` defaults to an empty mutable list – same: no migration needed.

---

## 8. Implementation Order

1. Domain: `CollaborationMode`, `JoinRequest`, extend `MapState`
2. Application: collaborator guard helper, apply to all existing mutating use cases
3. Application: `SetCollaborationModeUseCase`, `RequestJoinUseCase`, `AcceptJoinRequestUseCase`, `DeclineJoinRequestUseCase`; modify `JoinMapUseCase`, `GetMapUseCase`, `ListMapsUseCase`
4. Web adapter: DTOs, new endpoints, modify existing endpoints
5. Backend tests (all groups from §5)
6. Frontend types + API functions
7. Frontend UI: lobby, map settings, navbar join-request list, read-only guard

