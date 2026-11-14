# Gamify Porthole — Tower Defense Plan

## 1. Core model (server-authoritative)

- **New domain types** in `server/src/main/kotlin/team/dedica/porthole/domain/`:
  - `Bug(id, type, position, hp, state, targetLandmarkId, spawnedAt)`
  - `GameState(wave, phase: IDLE|ACTIVE|INTERMISSION, bugs, nextWaveAt, towerOccupants)`
- Add `gameState: GameState` to `SessionState.kt`.
- **Spawn tiles** = tiles whose landmark metric rollup is `ERROR` (reuse `worstLevel`/heatmap logic). Bugs emerge there, then wander or path to the nearest building via existing `AStarPathfinder`.
- **Attack**: on reaching a building, reduce its health; at zero, set its metric to `ERROR`. Damage is server-side.
- **Waves**: `GameTickUseCase` scheduled every ~500 ms — advance movement, spawn wave every N seconds from red tiles, broadcast state.

## 2. Combat & watchtowers

- REST commands (collaborator-only, one occupant per tower):
  - `POST /api/sessions/{id}/watchtower/{landmarkId}/enter`
  - `POST .../leave`
  - `POST .../shoot` with `{origin, direction}` — server resolves ballistic hit (ray/sphere against bugs) and removes the bug.
- Add `WatchtowerUseCase` + `ShootUseCase`; broadcast via new STOMP topic `/topic/map/{id}/game` (`MapStateBroadcaster.kt`).
- Shots are cosmetic on the client; server confirms hit/removal to prevent cheating.

## 3. Client rendering

- **Bug layer** in `HexGrid.tsx`: low-poly insect meshes (instanced for perf), animated along positions from game state; red emissive status.
- **First-person mode** in `useThreeScene.ts`: swap orbit camera for a first-person controller positioned inside the selected watchtower.
  - `W/S` = pitch, `A/D` = yaw, `Space` = fire.
  - Render simple tower interior (railing, window frame), dim exterior.
- **Ballistic projectile**: gravity-integrated mesh; on hit, hide bug optimistically and wait for server broadcast.
- **HUD**: wave number, bugs remaining, buildings under attack, "Enter Watchtower" button in `LandmarkPanel.tsx` when a `WATCHTOWER` is selected.

## 4. Client state

- Add `types/game.ts`, `gameStore` slice, and `mapApi` game calls; subscribe to `/topic/map/{id}/game` in the map page.
- Merge incoming game state like `pendingTiles` to avoid flicker.

## 5. Phases

1. Server domain + wave scheduler + broadcast (no combat).
2. Bug rendering and wandering.
3. Building targeting and damage.
4. Watchtower enter/leave + first-person camera.
5. WASD aiming, ballistic shots, server hit removal.
6. HUD, red-tile spawn polish, tests.

## 6. Tests

- Server: `GameTickUseCaseTest`, `ShootUseCaseTest` (hit/miss/auth), `WaveSchedulerTest`.
- Client: `gameStore`, bug renderer, first-person controls, watchtower HUD.

**Out of scope for v1:** bug types with distinct AI, scoring/leaderboards, sound, client-side netcode prediction.
