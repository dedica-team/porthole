# Code Review – Landmarks

**Datum:** 2026-03-15  
**Reviewer:** GitHub Copilot  
**Letztes Update:** 2026-03-15 (alle Befunde implementiert)

---

## Implementierungsstatus

| # | Priorität | Befund | Status |
|---|-----------|--------|--------|
| 1 | 🔴 HIGH | JWT-Secret über Umgebungsvariable | ✅ Implementiert |
| 2 | 🔴 HIGH | CORS-Origins konfigurierbar | ✅ Implementiert |
| 3 | 🔴 HIGH | `safeGroups()` Reflection entfernt | ✅ Implementiert |
| 4 | 🔴 HIGH | In-Memory `UserRepository` als `@Repository` entfernt | ✅ Implementiert |
| 5 | 🔴 HIGH | `groups`-Map in EclipseStore `save()` persistiert | ✅ Implementiert |
| 6 | 🟡 MEDIUM | WebSocket STOMP-Authentifizierung via `WebSocketAuthInterceptor` | ✅ Implementiert |
| 7 | 🟡 MEDIUM | OAuth State-Parameter-Check | ✅ War bereits implementiert (GitHubCallbackPage.tsx) |
| 8 | 🟡 MEDIUM | GitHub-OAuth-Logik in `GitHubOAuthService` ausgelagert | ✅ Implementiert |
| 9 | 🟡 MEDIUM | DTOs in `adapter.in.web.dto`-Package ausgelagert | ✅ Implementiert |
| 10 | 🟡 MEDIUM | `HexTile.ownerId` von `var` auf `val` geändert | ✅ Implementiert |
| 11 | 🟡 MEDIUM | `MapController` aufgeteilt → `GroupController`, `ConnectionController`, `TileController` | ✅ Implementiert |
| 12 | 🟡 MEDIUM | Concurrency-Lock (ReentrantLock pro mapId) in EclipseStore-Repository | ✅ Implementiert |
| 13 | 🟡 MEDIUM | `delete()` zum `MapStatePort`-Interface hinzugefügt | ✅ Implementiert |
| 14 | 🟡 MEDIUM | `CreateGroupUseCase`, `EditGroupUseCase`, `RemoveGroupUseCase` mit Collaborator-Check | ✅ Implementiert |
| 15 | 🟡 MEDIUM | `EditTileUseCase` mit Collaborator-Check und `username`-Parameter | ✅ Implementiert |
| 16 | 🟡 MEDIUM | `DataInitializer` auf `@Profile("dev")` beschränkt | ✅ Implementiert |
| 17 | 🟡 MEDIUM | Polling-Fehler in `LobbyPage` nach 3 Fehlversuchen anzeigen | ✅ Implementiert |
| 18 | 🟡 MEDIUM | `ErrorBoundary` um `HexGrid` und App-Root | ✅ Implementiert |
| 19 | 🟡 MEDIUM | `MapPage` mit `useShallow` (Zustand) statt vieler Einzel-Selektoren | ✅ Implementiert |
| 20 | 🟡 MEDIUM | `HexGrid.tsx` aufgeteilt: `useThreeScene.ts`, `useTilePicker.ts`, `useBrush.ts` | ✅ Implementiert |
| 21 | 🟡 MEDIUM | `MapController` MockMvc-Integrationstests hinzugefügt | ✅ Implementiert |
| 22 | 🟢 LOW | `PerlinNoise` in eigene Datei `domain/PerlinNoise.kt` ausgelagert | ✅ Implementiert |
| 23 | 🟢 LOW | Testklassen umbenannt: `PlaceTowerUseCaseTest` → `PlaceLandmarkUseCaseTest` etc. | ✅ Implementiert |
| 24 | 🟢 LOW | Terrain-Typen Backend ↔ Frontend: sind synchron | ✅ Verifiziert |
| 25 | 🟢 LOW | `getLandmarkColor()` gibt pro Typ unterschiedliche Farben zurück (Bug behoben) | ✅ Implementiert |

---

## Executive Summary

Die Codebasis ist insgesamt gut strukturiert und folgt den vorgegebenen Architekturprinzipien.
Alle identifizierten Befunde aus der initialen Review wurden implementiert.

---

## Nicht implementiert (bewusste Entscheidungen)

#### 🔴 HIGH – Token im `localStorage` (XSS-anfällig)

Erfordert Backend-Änderungen (HttpOnly-Cookies + CSRF-Token-Flow) und ist ein größeres Refactoring.
Als Zwischenlösung sollte eine strikte **Content-Security-Policy** im Webserver konfiguriert werden.

#### 🟡 MEDIUM – Slug-Kollision bei Landmark-IDs

Das aktuelle Verhalten (Fehler bei Kollision) ist korrekt und für den Nutzer nachvollziehbar.
Eine UUID-basierte ID würde das `getLandmarkAt()`-Lookup-Pattern ändern. Aufgeschoben.

#### 🟢 LOW – Frontend-Tests für Auth-Flow

Die vorhandenen Tests sind ausreichend für den aktuellen Reifegrad. Auth-Flow-Tests sind sinnvoll, aber kein kritisches Risiko.

---

## Positive Punkte

- ✅ Hexagonale Architektur (Ports & Adapters) konsequent umgesetzt
- ✅ Use-Cases gut isoliert, einheitlich strukturiert und vollständig autorisiert
- ✅ Domänenobjekte mit `data class`, `init`-Validierungen und vollständiger Immutabilität
- ✅ `GlobalExceptionHandler` mit sinnvollem HTTP-Status-Mapping
- ✅ Optimistische UI-Updates mit Pending-Tile-Mechanismus
- ✅ A*-Pfadfinder sauber im Domain-Layer implementiert
- ✅ 194 Backend-Tests + 90 Frontend-Tests, alle grün
- ✅ Klare Trennung von `BroadcastPort` / `MapStatePort` / `UserWritePort`
- ✅ `@Async` auf dem Broadcaster verhindert blockierende WebSocket-Sends
- ✅ Concurrency-sicherer EclipseStore-Zugriff via per-Map ReentrantLock
- ✅ WebSocket-Endpunkte durch STOMP-ChannelInterceptor authentifiziert
