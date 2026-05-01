# Admin Roles — Implementation Plan

## 1. Overview & Goals

Add a lightweight, config-driven admin role to Porthole. Admins are identified by a comma-separated list of user IDs in the environment variable `PORTHOLE_ADMIN_USER_IDS`. No database schema changes are required. Admins gain four abilities:

1. **Delete any session (map)** from the Lobby.
2. **Join any session as a collaborator** without an invite, regardless of `CollaborationMode`.
3. **Download the raw session JSON** from the Navbar while inside a map session.
4. **Reassign landmark ownership** from the landmark detail panel in the Sidebar.

Admin status is resolved at the application layer (server-side) and surfaced to the frontend via the `/api/auth/session` response. All privilege enforcement happens in backend use cases — the frontend flag is informational only.

---

## 2. Data Model Changes

**None.** Admin status is purely derived at runtime from the `PORTHOLE_ADMIN_USER_IDS` environment variable. No changes to `users.json` or session map files.

---

## 3. Backend Changes

### 3.1 Configuration — `application.yml`

**File:** `server/src/main/resources/application.yml`

Add a new key under the `porthole:` block:
```yaml
porthole:
  admin:
    user-ids: ${PORTHOLE_ADMIN_USER_IDS:}
```
Empty default means zero admin users in a fresh deployment — safe by default.

---

### 3.2 New `AdminService`

**New file:** `server/src/main/kotlin/team/dedica/porthole/adapter/in/web/security/AdminService.kt`

A `@Component` that:
- Injects `@Value("\${porthole.admin.user-ids:}")` as a `String`.
- Parses it into a `Set<String>` of trimmed UUIDs on construction (or a `@PostConstruct` method).
- Exposes `fun isAdmin(userId: String): Boolean`.
- Optionally logs a startup `WARN` via `@PostConstruct` when the set is empty, to help operators.

This is the single source of truth for admin resolution throughout the backend.

---

### 3.3 Propagate Admin Status via `/api/auth/session`

**File:** `server/src/main/kotlin/team/dedica/porthole/adapter/in/web/GitHubOAuthController.kt`

- Add `val isAdmin: Boolean = false` to the existing `AuthResponse` data class.
- Inject `AdminService` into the controller.
- In `GET /api/auth/session`: call `adminService.isAdmin(userRecord.id)` and include in the returned `AuthResponse`.
- In `POST /api/auth/github/callback`: include `isAdmin` in the `AuthResponse` body after successful login.
- In `WebAuthnController.kt` (if it returns an `AuthResponse` on login): same pattern.

No JWT claim changes needed — admin status is resolved fresh on every session check.

---

### 3.4 New Use Cases

#### 3.4.1 `DeleteMapUseCase`

**New file:** `server/src/main/kotlin/team/dedica/porthole/application/lobby/DeleteMapUseCase.kt`

- Signature: `fun execute(mapId: UUID, callerUserId: String)`
- Asserts `adminService.isAdmin(callerUserId)` — throws `AccessDeniedException` if not.
- Calls `mapStatePort.delete(mapId)` (method already exists on `MapStatePort`).
- Optionally sends a deletion broadcast via `BroadcastPort` so connected WebSocket clients can react.

#### 3.4.2 `AdminJoinMapUseCase`

**New file:** `server/src/main/kotlin/team/dedica/porthole/application/lobby/AdminJoinMapUseCase.kt`

- Signature: `fun execute(mapId: UUID, callerUsername: String): MapState`
- Resolves the user via `userPort.findByUsername(username)`.
- Asserts `adminService.isAdmin(user.id)` — throws `AccessDeniedException` if not.
- Bypasses the `CollaborationMode` check entirely (unlike `JoinMapUseCase`).
- Skips adding if already a collaborator (`state.getCollaborator(user.id) != null`).
- Adds `Collaborator`, saves, and broadcasts — mirroring `JoinMapUseCase`.

#### 3.4.3 `ChangeLandmarkOwnerUseCase`

**New file:** `server/src/main/kotlin/team/dedica/porthole/application/session/landscaping/ChangeLandmarkOwnerUseCase.kt`

- Signature: `fun execute(mapId: UUID, callerUsername: String, landmarkId: String, newOwnerId: String): MapState`
- Resolves caller; asserts `adminService.isAdmin(caller.id)`.
- Validates that `newOwnerId` is an existing collaborator on the map (`state.isCollaborator(newOwnerId)`).
- Updates: `state.landmarks[landmarkId] = landmark.copy(ownerId = newOwnerId)`.
- Saves and broadcasts.

---

### 3.5 New & Updated Endpoints in `MapController`

**File:** `server/src/main/kotlin/team/dedica/porthole/adapter/in/web/MapController.kt`

Inject `AdminService`, `DeleteMapUseCase`, `AdminJoinMapUseCase`, and `ChangeLandmarkOwnerUseCase`.

Add a private helper `fun resolveUserId(user: UserDetails): String` that calls `userPort.findByUsername(user.username)?.id` — needed because `UserDetails.username` is a string username, not the UUID that `isAdmin` requires.

| Endpoint | Method | Path | Implementation |
|---|---|---|---|
| Delete session | `DELETE` | `/api/maps/{id}` | `deleteMapUseCase.execute(id, resolveUserId(user))` → `204 No Content` |
| Admin join | `POST` | `/api/maps/{id}/admin-join` | `adminJoinMapUseCase.execute(id, user.username)` → `200 MapState` |
| Export session JSON | `GET` | `/api/maps/{id}/export` | Return `getMapUseCase` result with header `Content-Disposition: attachment; filename="session-{id}.json"` after asserting `adminService.isAdmin(resolveUserId(user))` |
| Change landmark owner | `PATCH` | `/api/maps/{id}/landmarks/{landmarkId}/owner` | Body: `{ "ownerId": "..." }`; calls `changeLandmarkOwnerUseCase.execute(...)` |

**Add a DTO** `ChangeLandmarkOwnerRequest(val ownerId: String)` in the appropriate `dto` package.

---

### 3.6 `GlobalExceptionHandler.kt` — Handle `AccessDeniedException`

**File:** `server/src/main/kotlin/team/dedica/porthole/adapter/in/web/GlobalExceptionHandler.kt`

Add a handler for `org.springframework.security.access.AccessDeniedException` returning `403 Forbidden` with a JSON error body, if not already present.

---

### 3.7 Optional: `ROLE_ADMIN` in `JwtAuthenticationFilter`

**File:** `server/src/main/kotlin/team/dedica/porthole/adapter/in/web/security/JwtAuthenticationFilter.kt`

Optionally add `SimpleGrantedAuthority("ROLE_ADMIN")` to the authorities list when `adminService.isAdmin(claims.userId)` is true. This enables `@PreAuthorize("hasRole('ADMIN')")` as an alternative/complementary guard style alongside use-case-level guards.

---

## 4. Frontend Changes

### 4.1 Transport Admin Flag

**File:** `client/src/types/map.ts`

Add `isAdmin?: boolean` to the `AuthSession` interface.

**File:** `client/src/store/mapStore.ts`

- Add `isAdmin: boolean` (default `false`) to the `AuthState` interface.
- Set it in `login(...)` and `setSession(...)` actions from the session response (`session?.isAdmin ?? false`).
- Reset to `false` in `logout(...)`.

**Auth page / session bootstrap files:** wherever `getSession()` / `githubCallback()` / `webauthnLogin()` results are applied to the store — pass `isAdmin` through.

---

### 4.2 New API Functions

**File:** `client/src/api/mapApi.ts`

Add four functions:

```typescript
// DELETE /api/maps/{id}
export async function deleteMap(mapId: string): Promise<void>

// POST /api/maps/{id}/admin-join
export async function adminJoinMap(mapId: string): Promise<MapState>

// GET /api/maps/{id}/export
export async function exportMapJson(mapId: string): Promise<MapState>

// PATCH /api/maps/{id}/landmarks/{landmarkId}/owner
export async function changeLandmarkOwner(mapId: UUID, landmarkId: string, ownerId: string): Promise<MapState>
```

---

### 4.3 Lobby — Delete Button & Admin Join Bypass

**File:** `client/src/pages/LobbyPage/LobbyPage.tsx`

- Read `isAdmin` from `useAuthStore`.
- **Delete button:** In the map row button group, when `isAdmin` is true, render a `Trash2` icon button (lucide-react). Gate it behind a confirmation dialog (reuse the existing inline dialog pattern in this file). On confirm, call `deleteMap(map.id)` and remove the map from the list on success.
- **Admin join:** When `isAdmin` is true, always show the **Join as Collaborator** button regardless of `collaborationMode` or pending join-request state. On click, call `adminJoinMap(mapId)` instead of the regular `joinMap` / `requestJoin`.

---

### 4.4 Navbar — Download Session JSON

**File:** `client/src/components/Navbar/Navbar.tsx`

- Read `isAdmin` from `useAuthStore`.
- Inside the `{isOnMap && currentMap && (...)}` section, when `isAdmin` is also true, add a **Download JSON** button (`Download` icon from lucide-react, consistent with existing nav button style, with a tooltip).
- On click:
  1. Call `exportMapJson(currentMap.id)`.
  2. `JSON.stringify(result, null, 2)` → `Blob('application/json')`.
  3. Create an object URL and programmatically click a hidden anchor element with `download="session-{currentMap.id}.json"`.
  4. Revoke the object URL afterward.

---

### 4.5 Sidebar Landmark Panel — Change Owner Dropdown

**File:** `client/src/components/Sidebar/panels/LandmarkPanel.tsx`

- Read `isAdmin` from `useAuthStore`, `currentMap` from `useMapStore`.
- When `isAdmin` is true and a landmark is selected, render an **Owner** `<select>` (or shadcn `<Select>`) below the existing landmark fields.
- Options come from `currentMap.collaborators` (id + username).
- Pre-select `landmark.ownerId`.
- On change: call `changeLandmarkOwner(currentMap.id, landmark.id, selectedOwnerId)` and update the store with the returned `MapState`.
- Show inline loading/error states consistent with existing edit controls in this panel.

---

## 5. Testing Plan

### Backend — Unit / Integration Tests (`server/src/test/`)

| Test class | What to assert |
|---|---|
| `AdminServiceTest` | Empty env → `isAdmin` always `false`; IDs parsed correctly; leading/trailing whitespace trimmed |
| `DeleteMapUseCaseTest` | Admin call invokes `mapStatePort.delete`; non-admin throws `AccessDeniedException` |
| `AdminJoinMapUseCaseTest` | Admin joins `PRIVATE` map successfully; already-collaborator case is idempotent/gracefully no-op |
| `ChangeLandmarkOwnerUseCaseTest` | Admin reassigns to valid collaborator; non-collaborator target rejected; non-admin caller rejected |
| `GET /api/auth/session` (integration) | Returns `"isAdmin": true` when caller in `PORTHOLE_ADMIN_USER_IDS`, `false` otherwise |
| `DELETE /api/maps/{id}` (integration) | `204` for admin, `403` for non-admin |
| `GET /api/maps/{id}/export` (integration) | `200` + `Content-Disposition` attachment header for admin, `403` for non-admin |
| `PATCH /api/maps/{id}/landmarks/{id}/owner` (integration) | `200` + updated `MapState` for admin, `403` for non-admin |

### Frontend — Component Tests (`client/src/test/`)

| Test file | What to assert |
|---|---|
| `AuthStore.test.ts` | `isAdmin` defaults `false`; set to `true` from session response; reset on logout |
| `LobbyPage.test.tsx` | Delete button renders for admins, hidden for users; confirmation dialog shown; admin join bypasses mode |
| `Navbar.test.tsx` (or `HUD.test.tsx`) | Download button renders when `isAdmin && isOnMap`; hidden otherwise |
| `LandmarkPanel.test.tsx` | Owner `<select>` visible for admins, not rendered for regular users; `changeLandmarkOwner` called on change |

---

## 6. Rollout & Configuration Notes

- Set `PORTHOLE_ADMIN_USER_IDS=<uuid1>,<uuid2>` in the deployment environment. UUIDs are the `id` fields from `data/json/users.json`.
- No data migration or session restart required — admin status is resolved per request at runtime.
- To revoke access: remove the UUID from `PORTHOLE_ADMIN_USER_IDS` and restart the server process.
- **Safe by default:** an empty or absent `PORTHOLE_ADMIN_USER_IDS` means no admin users exist.
- **Security boundary:** `isAdmin` in the `/session` response is purely informational for the UI. All real enforcement is server-side in use cases. A tampered frontend state cannot escalate privileges.
- Add a `@PostConstruct` startup log in `AdminService` (`logger.warn("No admin user IDs configured — admin features disabled")`) so operators can diagnose misconfiguration at a glance.

