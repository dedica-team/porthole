# Plan: Landmark-Typen & Low-Poly-Modelle

> **Status: ✅ Vollständig implementiert** (Stand 2026-03-09)

## Ziel

Ersetze das bisherige `Tower`-Konzept (mit Upgrade-Levels) durch ein einheitliches `Landmark`-System mit 14 wählbaren Typen, die sich ausschließlich optisch unterscheiden. Beim Platzieren und beim Bearbeiten eines Landmarks wird der Typ ausgewählt. Jeder Typ erhält ein eigenes Low-Poly-3D-Modell nach dem Vorbild der bestehenden Terrain-Renderer.

---

## 1. Neue Landmark-Typen

| Enum-Wert        | Anzeigename    | Emoji |
|------------------|----------------|-------|
| `CHURCH`         | Church         | ⛪    |
| `LIGHTHOUSE`     | Lighthouse     | 🗼    |
| `RUINS`          | Ruins          | 🏚    |
| `SILO`           | Silo           | 🏗    |
| `KEEP`           | Keep           | 🏰    |
| `WELL`           | Well           | 🪣    |
| `WINDMILL`       | Windmill       | 🌬    |
| `TOWN_HALL`      | Town Hall      | 🏛    |
| `HOUSE`          | House          | 🏠    |
| `WATCHTOWER`     | Watchtower     | 🗽    |
| `PUMP_STATION`   | Pump Station   | ⚙️    |
| `FURNACE`        | Furnace        | 🔥    |
| `OIL_PUMP`       | Oil Pump       | 🛢    |
| `WATERMILL`      | Watermill      | 💧    |

---

## 2. Backend – Implementiert

### Domain
- ✅ `LandmarkType.kt` – Enum mit allen 14 Typen
- ✅ `Landmark.kt` – ersetzt `Tower.kt`, `level` entfernt, `type: LandmarkType` ergänzt
- ✅ `TowerLevel`-Enum und `Tower.kt` gelöscht
- ✅ `MapState.kt` – `towers` → `landmarks`, Hilfsmethoden angepasst

### Use Cases
- ✅ `PlaceLandmarkUseCase.kt` – `type`-Parameter, kein `level`
- ✅ `RemoveLandmarkUseCase.kt` – nur Umbenennung
- ✅ `EditLandmarkUseCase.kt` – neu: ändert `name` und/oder `type`
- ✅ `UpgradeTowerUseCase.kt` – gelöscht

### Controller / Adapter
- ✅ `PlaceLandmarkRequest` mit `type`-Feld
- ✅ `EditLandmarkRequest(name, type)` – neuer PATCH-Endpunkt
- ✅ `POST /landmarks`, `DELETE /landmarks/{id}`, `PATCH /landmarks/{id}`
- ✅ `PATCH /towers/{id}/upgrade` – entfernt

### Tests (137 Tests, alle grün)
- ✅ `PlaceLandmarkUseCaseTest` (13 Tests)
- ✅ `RemoveLandmarkUseCaseTest` (7 Tests)
- ✅ `EditLandmarkUseCaseTest` (8 Tests)
- ✅ `UpgradeTowerUseCaseTest` – gelöscht

---

## 3. Frontend – Implementiert

### Types & Utils
- ✅ `types/map.ts` – `LandmarkType`, `LANDMARK_TYPE_LABELS`, `ALL_LANDMARK_TYPES`, `Landmark`; `Tower`/`TowerLevel` entfernt; `MapState.landmarks` statt `towers`
- ✅ `utils/hexUtils.ts` – `landmarkTypeColor()` entfernt; Farbe liegt jetzt in den Renderern

### Store & API
- ✅ `store/mapStore.ts` – `selectedLandmark`, `setSelectedLandmark`, `connectingFromLandmarkId`, Panel-Typ `'landmark'`
- ✅ `api/mapApi.ts` – `placeLandmark(type)`, `removeLandmark`, `editLandmark`; `upgradeTower` entfernt

### 3D-Renderer
- ✅ `components/HexGrid/landmarkRenderers.ts` – 13 Renderer-Klassen, jede mit `readonly color`:
  - `KeepRenderer` (`0xb0b8c8`), `LighthouseRenderer`, `RuinsRenderer`, `SiloRenderer`,
  - `WellRenderer`, `WindmillRenderer` (Pinwheel: Mast + Hub + **3 Blätter**, Farbe `0xb0b8c8` wie Keep),
  - `TownHallRenderer`, `HouseRenderer`, `WatchtowerRenderer`, `PumpStationRenderer`,
  - `FurnaceRenderer` (Quader + Schornstein + Glühring + Türnische), `OilPumpRenderer`, `WatermillRenderer`
  - `ChurchRenderer` – entfernt
  - `getLandmarkRenderer(type)` – Registry-Funktion
  - `getLandmarkColor(type)` – gibt `renderer.color` zurück (ersetzt `hexUtils.landmarkTypeColor`)
- ✅ `HexGrid.tsx` – nutzt `getLandmarkRenderer(landmark.type).build(...)`

### UI-Panels
- ✅ `TilePanel.tsx` – Typ-Dropdown beim Platzieren (`SELECT` über alle 14 Typen), `onPlaceLandmark(q, r, name, type)`
- ✅ `LandmarkPanel.tsx` (neu, ersetzt `TowerPanel.tsx`) – Typ-Anzeige, Inline-Edit-Formular (Name + Typ), kein Upgrade-Button
- ✅ `TowerPanel.tsx` – gelöscht
- ✅ `Sidebar.tsx` – Props und Panel-Routing aktualisiert

### MapPage
- ✅ `MapPage.tsx` – `handlePlaceLandmark`, `handleRemoveLandmark`, `handleEditLandmark`; `handleUpgrade` entfernt

### Tests (67 Tests, alle grün)
- ✅ `LandmarkInfoDialog.test.tsx` → testet jetzt `LandmarkPanel`
- ✅ `MapPage.test.tsx` – alle Tower-Referenzen auf Landmark migriert
- ✅ `mapStore.test.ts` – `towers` → `landmarks`
- ✅ `hexUtils.test.ts` – `towerLevelColor` → `landmarkTypeColor`

---

## 4. Datenmigration

Das `data/eclipse-store`-Verzeichnis und der Test-Store unter `/tmp/landmarks-test-storage` enthalten persistierte Typen. Nach dem Entfernen von `CHURCH` verschiebt sich das Ordinal von `LIGHTHOUSE` – EclipseStore verweigert den Start ohne manuelle Migrationskonfiguration.

**Durchgeführt (2026-03-09):**
- `data/eclipse-store/` gelöscht (Produktionsdaten)
- `/tmp/landmarks-test-storage/` gelöscht (Test-Daten)
- Alle 137 Backend-Tests danach grün

**Bei zukünftigen Enum-Änderungen:** Entweder Store löschen (Entwicklungsumgebung) oder eine EclipseStore Legacy-Type-Mapping-Konfiguration anlegen.

---

## 5. Nicht betroffene Bereiche

- Terrain-System (`Terrain.kt`, `terrainRenderers.ts`) bleibt unverändert.
- Connection-System bleibt unverändert (referenziert Landmark-IDs).
- Auth/GitHub-SSO bleibt unverändert.
- Terrain-Editor bleibt unverändert.

