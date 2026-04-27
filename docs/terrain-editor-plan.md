# Plan: Terrain-System & Landscape-Editor

> Erstellt: 2026-03-04

## Konzept

Jede Hex-Tile erhält neben `elevation` ein neues Feld `terrain`, das den
visuellen Biom-Typ beschreibt. Der Terrain-Typ wird aus der Elevation
abgeleitet, kann aber vom Editor überschrieben werden. Ein schaltbarer
**Landscape-Editor-Modus** im Client erlaubt es, Elevation (Raise/Lower) und
Terrain-Typ frei auf einzelnen Tiles zu setzen. Die 3-D-Darstellung im HexGrid
wird um terranspezifische Farben, Baummodelle (Elevation 2) und felsige
Tile-Tops (Elevation 3) erweitert.

### Terrain-Mapping (Standardwerte)

| Elevation | Terrain  | Farbe (top)       | Visuelle Besonderheit              |
|-----------|----------|-------------------|------------------------------------|
| 0         | WATER    | `#1a6b9a` (blau)  | Flache Fläche, kein Baurecht       |
| 1         | GRASS    | `#4caf50` (grün)  | Normale Höhe                       |
| 2         | FOREST   | `#2d6a2d` (dunkelgrün) | Baummodelle auf der Fläche    |
| 3+        | ROCKS    | `#7a7060` (grau-braun) | Unregelmäßige felsige Spitze   |

---

## Server

### 1. `domain/Terrain.kt` *(neu)* ✅

```kotlin
enum class Terrain { WATER, GRASS, FOREST, ROCKS }
```

Statisches Hilfsmittel, das den Default-Terrain aus der Elevation ableitet:

```kotlin
fun Terrain.Companion.fromElevation(e: Int): Terrain = when {
    e == 0  -> WATER
    e == 1  -> GRASS
    e == 2  -> FOREST
    else    -> ROCKS
}
```

### 2. `domain/HexTile.kt` – erweitern ✅

- Neues Feld `terrain: Terrain` ergänzen, Default via `Terrain.fromElevation(elevation)`
- `isWalkable` bleibt `elevation > 0`
- `init`-Block Validierung bleibt unverändert

```kotlin
data class HexTile(
    val coordinate: HexCoordinate,
    val elevation: Int = 0,
    val terrain: Terrain = Terrain.fromElevation(elevation),
    var ownerId: String? = null,
)
```

### 3. `application/EditTileUseCase.kt` *(neu)* ✅

Verändert Elevation und/oder Terrain eines einzelnen Tiles.

```
Eingabe: gameId, coordinate, elevation: Int?, terrain: Terrain?
```

Regeln:
1. Session muss existieren
2. Tile an `coordinate` muss existieren
3. `elevation` wenn angegeben: muss in `0..10` liegen
4. Wenn sich Elevation ändert und kein explizites `terrain` übergeben wird,
   wird `terrain` automatisch aus der neuen Elevation abgeleitet
5. Tile im `GameMap` ersetzen (`tileMap.setTile`)
6. Speichern und broadcasten

### 4. `domain/GameMap.kt` – `setTile` ergänzen ✅

```kotlin
fun setTile(coordinate: HexCoordinate, tile: HexTile) {
    tileMap[coordinate] = tile
}
```

### 5. `adapter/in/web/GameController.kt` – neuer Endpoint ✅

```
PATCH /api/games/{id}/tiles/{q}/{r}
Body: { elevation?: Int, terrain?: String }
```

### 6. Tests ✅

#### `domain/TerrainTest.kt` *(neu)* ✅
- `fromElevation(0)` → `WATER`
- `fromElevation(1)` → `GRASS`
- `fromElevation(2)` → `FOREST`
- `fromElevation(3)` → `ROCKS`
- `fromElevation(10)` → `ROCKS`

#### `domain/HexTileTest.kt` – erweitern ✅
- Default-Terrain aus Elevation wird korrekt abgeleitet
- Explizites Terrain überschreibt den Default
- `isWalkable` weiterhin korrekt für alle Terrain-Typen

#### `application/EditTileUseCaseTest.kt` *(neu)* ✅
- Elevation ändern aktualisiert Tile und leitet neues Default-Terrain ab
- Terrain explizit setzen ohne Elevation-Änderung
- Elevation + Terrain zusammen setzen
- Ungültige Elevation (`< 0` oder `> 10`) wirft Fehler
- Unbekannte Koordinate wirft Fehler

---

## Client

### 1. `types/game.ts` – erweitern ✅

```typescript
export type Terrain = 'WATER' | 'GRASS' | 'FOREST' | 'ROCKS';

// HexTile erweitern:
export interface HexTile {
  coordinate: HexCoordinate;
  elevation: number;
  terrain: Terrain;
  ownerId: string | null;
}
```

### 2. `api/gameApi.ts` – neue Funktion ✅

```typescript
editTile(gameId, q, r, elevation?: number, terrain?: Terrain): Promise<GameState>
// PATCH /api/games/{gameId}/tiles/{q}/{r}
```

### 3. `store/gameStore.ts` – Editor-Modus-Zustand ✅

```typescript
editorMode: boolean;
editorTool: 'RAISE' | 'LOWER' | 'TERRAIN';
editorTerrain: Terrain;
setEditorMode: (on: boolean) => void;
setEditorTool: (tool: 'RAISE' | 'LOWER' | 'TERRAIN') => void;
setEditorTerrain: (terrain: Terrain) => void;
```

### 4. `components/LandscapeEditor/` *(neu)* ✅

Verzeichnis: `LandscapeEditor.tsx` + `LandscapeEditor.module.css`

Eine schwebende Toolbar (ähnlich dem HUD), die nur im Editor-Modus sichtbar ist.

Inhalt:
- Toggle-Button „Editor Mode" (auch im normalen Modus sichtbar zum Einschalten)
- Tool-Gruppe: **Raise ▲**, **Lower ▼**, **Set Terrain**
- Bei „Set Terrain": Dropdown/Buttons für `GRASS`, `FOREST`, `ROCKS`
  (WATER nur über Lower auf 0 erreichbar)
- Aktuell ausgewähltes Tile und sein Terrain/Elevation werden angezeigt

Props:
```typescript
interface Props {
  active: boolean;
  tool: 'RAISE' | 'LOWER' | 'TERRAIN';
  terrain: Terrain;
  selectedTile: { q: number; r: number } | null;
  currentTileInfo: { elevation: number; terrain: Terrain } | null;
  onToggle: () => void;
  onToolChange: (tool: 'RAISE' | 'LOWER' | 'TERRAIN') => void;
  onTerrainChange: (terrain: Terrain) => void;
}
```

### 5. `pages/GamePage/GamePage.tsx` – Editor-Logik integrieren ✅

- `LandscapeEditor`-Komponente einbinden
- Im Editor-Modus ändert `handleTileClick` sein Verhalten:
  - **RAISE**: `editTile(gameId, q, r, tile.elevation + 1)`
  - **LOWER**: `editTile(gameId, q, r, tile.elevation - 1)` (min 0)
  - **TERRAIN**: `editTile(gameId, q, r, undefined, editorTerrain)`
- Im Normal-Modus: unverändertes bisheriges Verhalten

### 6. `utils/hexUtils.ts` – `terrainColor` Funktion *(neu)* ✅

```typescript
export function terrainColor(terrain: Terrain, ownerId: string | null, playerIndex: number): number {
  // Wenn owned: playerColor(playerIndex) überschreibt Terrain-Farbe
  // Wenn neutral: Farbe nach Terrain
  if (ownerId !== null && playerIndex >= 0) return playerColor(playerIndex);
  switch (terrain) {
    case 'WATER':  return 0x1a6b9a;
    case 'GRASS':  return 0x4caf50;
    case 'FOREST': return 0x2d6a2d;
    case 'ROCKS':  return 0x7a7060;
  }
}
```

### 7. `components/HexGrid/HexGrid.tsx` – visuelle Erweiterungen ✅

#### 7a. Terrain-Farben ✅

- `buildTileGroup` erhält Terrain als Parameter
- `topMat.color` wird über `terrainColor()` gesetzt statt `TILE_COLOR_NEUTRAL`
- Highlight-`useEffect` nutzt ebenfalls `terrainColor()` für den Base-Color

#### 7b. Baummodelle auf FOREST-Tiles (Elevation 2) ✅

- Eigener `useRef`: `forestMeshMapRef`
- Eigener `useEffect` abhängig von `game.map.tiles`
- Pro FOREST-Tile: 2–3 `ConeGeometry`-Bäume (Stamm = schmaler Zylinder,
  Krone = grüner Kegel) zufällig innerhalb des Hex-Radius verteilt
- Zufälligkeit deterministisch aus `(q, r)` berechnen (kein `Math.random()`)
  damit Bäume bei Re-Renders stabil bleiben

#### 7c. Felsige Tops auf ROCKS-Tiles (Elevation ≥ 3) ✅

- Eigener `useRef`: `rockMeshMapRef`
- Eigener `useEffect` abhängig von `game.map.tiles`
- Statt der flachen Deckfläche: `DodecahedronGeometry` (niedrig skaliert,
  `detail = 0`) oben auf dem Tile, grau-braun gefärbt
- Leicht zufällig rotiert (deterministisch aus Koordinaten)

### 8. Tests ✅

#### `test/LandscapeEditor.test.tsx` *(neu)* ✅
- Toolbar ist im Normal-Modus nicht sichtbar (oder nur Toggle-Button)
- Toolbar erscheint nach Toggle
- Raise/Lower/Terrain-Buttons wechseln das aktive Tool
- Terrain-Auswahl nur sichtbar wenn Tool = TERRAIN
- Aktuell ausgewähltes Tile und Info werden angezeigt

#### `test/GamePage.test.tsx` – erweitern ✅
- Im Editor-Modus RAISE: Klick auf Tile ruft `editTile` mit `elevation + 1`
- Im Editor-Modus LOWER: Klick auf Tile ruft `editTile` mit `elevation - 1`
- Im Editor-Modus TERRAIN: Klick ruft `editTile` mit gewähltem Terrain
- Im Normal-Modus bleibt das bisherige Verhalten erhalten

#### `test/hexUtils.test.ts` – erweitern ✅
- `terrainColor` gibt korrekte Farbe pro Terrain-Typ zurück
- `terrainColor` gibt `playerColor` zurück wenn Tile owned ist

---

## Datei-Übersicht

| Datei | Status |
|---|---|
| `server/.../domain/Terrain.kt` | ✅ implementiert |
| `server/.../domain/HexTile.kt` | ✅ erweitert (`terrain`) |
| `server/.../domain/GameMap.kt` | ✅ erweitert (`setTile`) |
| `server/.../application/EditTileUseCase.kt` | ✅ implementiert |
| `server/.../adapter/in/web/GameController.kt` | ✅ erweitert (PATCH endpoint) |
| `server/.../domain/TerrainTest.kt` | ✅ implementiert |
| `server/.../domain/HexTileTest.kt` | ✅ erweitert |
| `server/.../application/EditTileUseCaseTest.kt` | ✅ implementiert |
| `client/src/types/game.ts` | ✅ erweitert (`Terrain`, `HexTile.terrain`) |
| `client/src/api/gameApi.ts` | ✅ erweitert (`editTile`) |
| `client/src/store/gameStore.ts` | ✅ erweitert (Editor-Zustand) |
| `client/src/utils/hexUtils.ts` | ✅ erweitert (`terrainColor`) |
| `client/src/components/LandscapeEditor/LandscapeEditor.tsx` | ✅ implementiert |
| `client/src/components/LandscapeEditor/LandscapeEditor.module.css` | ✅ implementiert |
| `client/src/components/HexGrid/HexGrid.tsx` | ✅ erweitert (Terrain-Farben, Bäume, Felsen) |
| `client/src/pages/GamePage/GamePage.tsx` | ✅ erweitert (Editor-Logik) |
| `client/src/test/LandscapeEditor.test.tsx` | ✅ implementiert |
| `client/src/test/GamePage.test.tsx` | ✅ erweitert (Editor-Tests) |
| `client/src/test/hexUtils.test.ts` | ✅ erweitert (`terrainColor`) |

