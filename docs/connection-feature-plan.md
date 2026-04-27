# Plan: Tower-Verbindungs-Feature

> Erstellt: 2026-03-04  
> Status: ✅ vollständig implementiert

## Konzept

Ein **Connection**-Objekt repräsentiert einen A\*-berechneten Pfad zwischen zwei Türmen über begehbare Hex-Tiles. Es wird server- und clientseitig als First-Class-Objekt modelliert und im `GameState` gespeichert. Der Nutzer wählt einen Quellturm, öffnet einen Info-Dialog, klickt „Create Connection" und wählt dann einen Zielturm per Klick.

---

## Server

### 1. `domain/Connection.kt` *(neu)* ✅
```kotlin
data class Connection(
    val id: String,
    val fromTowerId: String,
    val toTowerId: String,
    val path: List<HexCoordinate>   // vollständiger A*-Pfad inkl. Start und Ziel
)
```

### 2. `domain/AStarPathfinder.kt` *(neu)* ✅
Stateless-Objekt mit einer einzigen Funktion:
```kotlin
object AStarPathfinder {
    fun findPath(
        map: GameMap,
        from: HexCoordinate,
        to: HexCoordinate
    ): List<HexCoordinate>?   // null wenn kein Pfad existiert
}
```
- **Heuristik:** `HexCoordinate.distanceTo()` (admissible für Hex-Grids)
- **Gewichte:** jede begehbare Kante kostet 1; Wasser-Tiles (`elevation == 0`) sind nicht traversierbar
- Gibt `null` zurück wenn Start/Ziel nicht existieren oder kein Pfad gefunden wird

### 3. `domain/GameState.kt` – erweitern ✅
```kotlin
val connections: MutableMap<String, Connection> = mutableMapOf()
```

### 4. `application/CreateConnectionUseCase.kt` *(neu)* ✅
```
Eingabe: gameId, username, fromTowerId, toTowerId
```
Regeln (in dieser Reihenfolge geprüft):
1. Session und beide Türme müssen existieren
2. `fromTowerId != toTowerId`
3. Beide Türme müssen dem anfragenden Nutzer gehören
4. Zwischen denselben zwei Türmen darf noch keine Connection existieren
5. A\*-Pfad berechnen → falls kein Pfad: Fehler
6. Connection in `state.connections` speichern, broadcasten, State zurückgeben

### 5. `adapter/in/web/GameController.kt` – neuer Endpoint ✅
```
POST /api/games/{id}/connections
Body: { fromTowerId: String, toTowerId: String }
```

### 6. Tests ✅

#### `domain/AStarPathfinderTest.kt` *(neu)* ✅
- Pfad auf einfacher 3×3-Karte gefunden
- Pfad umgeht Wasser-Tiles korrekt
- Start == Ziel → einelementiger Pfad `[start]`
- Kein Pfad durch vollständige Wasser-Barriere → `null`
- Pfad ist der kürzeste (direkte Linie ohne Hindernisse)

#### `domain/ConnectionTest.kt` *(neu)* ✅
- Daten-Eigenschaften: `id`, `fromTowerId`, `toTowerId`, `path` korrekt gesetzt

#### `application/CreateConnectionUseCaseTest.kt` *(neu)* ✅
- Erfolgsfall: Connection wird gespeichert und Pfad enthält Start- und Endkoordinate
- Fehler: `fromTowerId == toTowerId`
- Fehler: Turm gehört einem anderen Nutzer
- Fehler: Connection zwischen denselben Türmen existiert bereits
- Fehler: Kein Pfad möglich (Wasser-Barriere zwischen den Türmen)
- Fehler: Turm nicht gefunden

---

## Client

### 1. `types/game.ts` – erweitern ✅
```typescript
export interface Connection {
    id: string;
    fromTowerId: string;
    toTowerId: string;
    path: HexCoordinate[];
}

// In GameState:
connections: Record<string, Connection>;
```

### 2. `api/gameApi.ts` – neue Funktion ✅
```typescript
createConnection(gameId, fromTowerId, toTowerId): Promise<GameState>
// POST /api/games/{gameId}/connections
```

### 3. `components/TowerInfoDialog/` *(neu)* ✅
Neues Komponenten-Verzeichnis mit `TowerInfoDialog.tsx` und `TowerInfoDialog.module.css`.

Der Dialog zeigt:
- Turm-ID (gekürzt), Level, Besitzer
- Alle existierenden Verbindungen des Turms (Ziel-Turm-ID gekürzt)
- Button **„Create Connection"** → schließt den Dialog und aktiviert den Verbindungs-Modus

Props:
```typescript
interface Props {
  tower: Tower;
  connections: Connection[];
  isOwner: boolean;
  onCreateConnection: () => void;
  onClose: () => void;
}
```

### 4. `store/gameStore.ts` – Zustand für Verbindungs-Modus ✅
```typescript
connectingFromTowerId: string | null;
setConnectingFromTower: (id: string | null) => void;
```

### 5. `pages/GamePage/GamePage.tsx` – Logik erweitern ✅

**Klick-Fluss:**
1. Klick auf Tile mit Turm → öffnet `TowerInfoDialog`
2. Im Dialog: „Create Connection" → setzt `connectingFromTowerId`, schließt Dialog, zeigt Hinweis-Banner
3. Klick auf zweites Tile mit Turm (während Verbindungs-Modus) → ruft `createConnection` auf
4. Klick auf leeres Tile oder `Escape` → bricht Verbindungs-Modus ab

`handleTileClick` wird angepasst:
- Wenn `connectingFromTowerId` gesetzt und Ziel-Tile hat Turm → `createConnection` aufrufen
- Wenn `connectingFromTowerId` gesetzt und kein Turm → Modus abbrechen
- Normaler Einzelklick selektiert Tile; Doppelklick auf leeres Tile öffnet Platzierungs-Dialog (unverändert)

### 6. `HexGrid.tsx` – Verbindungen rendern ✅
In `useEffect` für `game.connections`:
- Für jede Connection: die `path`-Koordinaten als `THREE.TubeGeometry` oder `THREE.Line` über den Tiles rendern
- Farbe: weißlich-blau, leicht erhöht über Tile-Oberfläche
- Beim Verbindungs-Modus: Quellturm-Tile gold highlighten (wie selektiertes Tile)

### 7. Tests ✅

#### `test/GamePage.test.tsx` – erweitern ✅
- Klick auf Turm-Tile öffnet `TowerInfoDialog`
- Klick „Create Connection" setzt Verbindungs-Modus und zeigt Banner
- Klick auf zweiten Turm ruft `createConnection`-API auf
- Klick auf leeres Tile bricht Verbindungs-Modus ab
- `Escape`-Taste bricht Verbindungs-Modus ab

#### `test/LandmarkInfoDialog.test.tsx` *(neu)* ✅
- Rendert Turm-Level und Besitzer
- „Create Connection"-Button nur sichtbar wenn `isOwner === true`
- Bestehende Verbindungen werden aufgelistet
- `onCreateConnection` wird beim Klick aufgerufen
- `onClose` wird beim Klick auf Backdrop aufgerufen

#### `test/hexUtils.test.ts` – keine Änderung nötig ✅

---

## Datei-Übersicht

| Datei | Status |
|---|---|
| `server/.../domain/Connection.kt` | ✅ implementiert |
| `server/.../domain/AStarPathfinder.kt` | ✅ implementiert |
| `server/.../domain/GameState.kt` | ✅ erweitert (`connections`) |
| `server/.../application/CreateConnectionUseCase.kt` | ✅ implementiert |
| `server/.../adapter/in/web/GameController.kt` | ✅ erweitert (POST endpoint) |
| `server/.../domain/AStarPathfinderTest.kt` | ✅ implementiert |
| `server/.../domain/ConnectionTest.kt` | ✅ implementiert |
| `server/.../application/CreateConnectionUseCaseTest.kt` | ✅ implementiert |
| `client/src/types/game.ts` | ✅ erweitert |
| `client/src/api/gameApi.ts` | ✅ erweitert |
| `client/src/store/gameStore.ts` | ✅ erweitert |
| `client/src/components/TowerInfoDialog/TowerInfoDialog.tsx` | ✅ implementiert |
| `client/src/components/TowerInfoDialog/TowerInfoDialog.module.css` | ✅ implementiert |
| `client/src/pages/GamePage/GamePage.tsx` | ✅ erweitert |
| `client/src/components/HexGrid/HexGrid.tsx` | ✅ erweitert (Connection-Rendering) |
| `client/src/test/LandmarkInfoDialog.test.tsx` | ✅ implementiert |
| `client/src/test/GamePage.test.tsx` | ✅ erweitert |
